import { parseArgs } from 'node:util';
import { unifiedDiff } from '../classify/diff.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import type { Io } from '../cli/io.js';
import { formatDetail, formatList } from '../review/format.js';
import { printable } from '../shared/printable.js';
import type { FailureSource } from '../storage/failures.js';
import type { FailureStatus } from '../storage/review-queries.js';
import type { Store } from '../storage/store.js';
import type { Command } from './command.js';
import { openExistingStore, openExistingStoreForWrite } from './existing-store.js';

export const DEFAULT_REVIEW_LIMIT = 20;
const MAX_LIMIT = 200;
const MAX_IDS = 200;
const STATUSES: readonly FailureStatus[] = ['flagged', 'confirmed', 'dismissed'];
const SOURCES: readonly FailureSource[] = ['manual-fix', 'ai-self-fix'];
const MARKS = { confirm: ['confirmed', 'Confirmed'], dismiss: ['dismissed', 'Dismissed'], reset: ['flagged', 'Reset'] } as const;
type Mark = keyof typeof MARKS;

export interface ReviewDeps {
  readonly cwd: () => string;
}

type Action =
  | { readonly kind: 'list'; readonly statuses: readonly FailureStatus[] | null; readonly source: FailureSource | null; readonly limit: number; readonly json: boolean }
  | { readonly kind: 'show'; readonly id: number; readonly json: boolean }
  | { readonly kind: 'mark'; readonly mark: Mark; readonly ids: readonly number[] };

class UsageError extends Error {}

function parseId(value: string): number {
  const match = /^#?([1-9]\d{0,9})$/.exec(value);
  if (match === null) throw new UsageError(`'${value}' is not a failure id`);
  return Number(match[1]);
}

function parseList(args: readonly string[]): Action {
  const { values } = parseArgs({
    args: [...args],
    options: {
      status: { type: 'string' },
      source: { type: 'string' },
      limit: { type: 'string' },
      json: { type: 'boolean' },
    },
    strict: true,
    allowPositionals: false,
  });
  const status = values.status ?? 'flagged';
  if (status !== 'all' && !STATUSES.includes(status as FailureStatus)) {
    throw new UsageError(`--status must be one of ${[...STATUSES, 'all'].join(', ')}`);
  }
  if (values.source !== undefined && !SOURCES.includes(values.source as FailureSource)) {
    throw new UsageError(`--source must be one of ${SOURCES.join(', ')}`);
  }
  const limit = values.limit === undefined ? DEFAULT_REVIEW_LIMIT : /^[1-9]\d{0,2}$/.test(values.limit) ? Number(values.limit) : Number.NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new UsageError(`--limit must be a whole number from 1 to ${MAX_LIMIT}`);
  return {
    kind: 'list',
    statuses: status === 'all' ? null : [status as FailureStatus],
    source: (values.source as FailureSource | undefined) ?? null,
    limit,
    json: values.json === true,
  };
}

function positionals(args: readonly string[]): readonly string[] {
  return parseArgs({ args: [...args], options: {}, strict: true, allowPositionals: true }).positionals;
}

function parseAction(args: readonly string[]): Action {
  const [first, ...rest] = args;
  if (first === undefined || first.startsWith('-')) return parseList(args);
  if (first === 'list') return parseList(rest);
  if (first === 'show') {
    const { values, positionals } = parseArgs({
      args: [...rest],
      options: { json: { type: 'boolean' } },
      strict: true,
      allowPositionals: true,
    });
    if (positionals.length !== 1) throw new UsageError('show takes exactly one id');
    return { kind: 'show', id: parseId(positionals[0] as string), json: values.json === true };
  }
  if (Object.hasOwn(MARKS, first)) {
    const ids = positionals(rest);
    if (ids.length === 0) throw new UsageError(`${first} needs at least one id`);
    if (ids.length > MAX_IDS) throw new UsageError(`${first} takes at most ${MAX_IDS} ids at once`);
    return { kind: 'mark', mark: first as Mark, ids: ids.map(parseId) };
  }
  throw new UsageError(`unknown subcommand '${first}'`);
}

const plural = (n: number) => (n === 1 ? 'failure' : 'failures');
const idList = (ids: readonly number[]) => ids.map((id) => `#${id}`).join(', ');

function runMark(store: Store, action: Extract<Action, { kind: 'mark' }>, io: Io): number {
  const [status, verb] = MARKS[action.mark];
  const result = store.setFailureStatus(action.ids, status);
  if (!result.ok) {
    io.stderr(`nightowl review: no failure ${idList(result.missing)}; nothing was changed\n`);
    return 1;
  }
  const lines: string[] = [];
  if (result.changed.length > 0) {
    const tail = action.mark === 'reset' ? ' to flagged' : '';
    lines.push(`${verb} ${result.changed.length} ${plural(result.changed.length)} (${idList(result.changed)})${tail}.`);
  }
  if (result.unchanged.length > 0) {
    const was = result.unchanged.length === 1 ? 'was' : 'were';
    lines.push(`${result.changed.length === 0 ? 'No change: ' : ''}${idList(result.unchanged)} ${was} already ${status}.`);
  }
  io.stdout(`${lines.join('\n')}\n`);
  return 0;
}

function runRead(store: Store, action: Exclude<Action, { kind: 'mark' }>, io: Io): number {
  if (action.kind === 'show') {
    const failure = store.getFailureForReview(action.id);
    if (failure === null) {
      io.stderr(`nightowl review: no failure #${action.id}\n`);
      return 1;
    }
    if (action.json) {
      const diff = unifiedDiff(failure.aiContent, failure.finalContent);
      io.stdout(`${JSON.stringify({ ...failure, diff }, null, 2)}\n`);
    } else {
      io.stdout(formatDetail(failure));
    }
    return 0;
  }
  const failures = store.listFailuresForReview(action);
  if (action.json) {
    io.stdout(`${JSON.stringify(failures, null, 2)}\n`);
  } else {
    io.stdout(formatList(failures, action.statuses === null ? null : (action.statuses[0] as string)));
  }
  return 0;
}

export function createReviewCommand(deps: ReviewDeps = { cwd: () => process.cwd() }): Command {
  return {
    name: 'review',
    summary: 'List recorded failures, show one, and mark them confirmed or dismissed',
    help: renderCommandHelp({
      name: 'review',
      usage: '[list | show <id> | confirm <id...> | dismiss <id...> | reset <id...>] [options]',
      description: [
        'list              Failures to look at, newest first (the default)',
        'show <id>         One failure: prompts, classification and the diff',
        'confirm <id...>   Mark as a real AI mistake',
        'dismiss <id...>   Mark as noise; left out of report and export',
        'reset <id...>     Back to flagged',
        "Ids are the numbers list shows (12; '#12' works too, quoted). Nothing is sent anywhere.",
      ],
      options: [
        ['--status <name>', `list only: ${[...STATUSES, 'all'].join(', ')} (default: flagged)`],
        ['--source <name>', `list only: ${SOURCES.join(', ')}`],
        [`--limit <1-${MAX_LIMIT}>`, `list only: at most this many (default: ${DEFAULT_REVIEW_LIMIT})`],
        ['--json', 'Output list or show detail as JSON'],
      ],
    }),
    run: async (args, io) => {
      let action: Action;
      try {
        action = parseAction(args);
      } catch (error) {
        io.stderr(`nightowl review: ${printable(errorMessage(error))}\nRun 'nightowl review --help'.\n`);
        return 1;
      }
      const store = action.kind === 'mark' ? await openExistingStoreForWrite(deps.cwd()) : await openExistingStore(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl review: ${store}\n`);
        return 1;
      }
      try {
        return action.kind === 'mark' ? runMark(store, action, io) : runRead(store, action, io);
      } catch (error) {
        io.stderr(`nightowl review: ${printable(errorMessage(error))}\n`);
        return 1;
      } finally {
        store.close();
      }
    },
  };
}

export const reviewCommand = createReviewCommand();
