import { parseArgs } from 'node:util';
import { AGENT_IDS, isAnyAgentId } from '../agents/ids.js';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import { CATEGORIES } from '../classify/prompt.js';
import { compareRuleImpact, DEFAULT_WINDOW_DAYS, formatImpactJson, formatImpactText } from '../impact/compare.js';
import { ruleLoopNextStepsAfterMark } from '../impact/loop-hints.js';
import { UNCLASSIFIED } from '../report/build.js';
import { parseDateOption } from '../shared/date-option.js';
import { printable } from '../shared/printable.js';
import type { Command } from './command.js';
import { openExistingStore, openExistingStoreForWrite } from './existing-store.js';

const CATEGORY_NAMES = new Set([...Object.keys(CATEGORIES), UNCLASSIFIED]);
const MAX_DEPTH = 5;
const DEFAULT_DEPTH = 2;
const MAX_DAYS = 365;

export interface RuleImpactDeps {
  readonly cwd: () => string;
  readonly now: () => Date;
}

function parseAppliedAt(raw: string | undefined, now: Date): string | { error: string } {
  if (raw === undefined) return now.toISOString();
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { error: '--at cannot be empty' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const iso = parseDateOption(trimmed);
    if (iso === null) return { error: `invalid --at date: ${trimmed}` };
    return iso;
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return { error: `invalid --at timestamp: ${trimmed}` };
  return new Date(ms).toISOString();
}

function parseDays(raw: string | undefined, flag: string): number | string {
  if (raw === undefined) return DEFAULT_WINDOW_DAYS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) return `${flag} must be a whole number from 1 to ${MAX_DAYS}`;
  return n;
}

export function createRuleImpactCommand(deps: RuleImpactDeps = { cwd: () => process.cwd(), now: () => new Date() }): Command {
  return {
    name: 'rule-impact',
    summary: 'Mark applied rules and compare failure counts before/after',
    help: renderCommandHelp({
      name: 'rule-impact',
      usage: '[mark] [options]',
      description: [
        'Marks a rule as applied with a local baseline snapshot, or compares failure counts',
        'in equal-length windows before and after apply. Offline; no LLM; does not change report CI gate.',
        'Default (no mark): show impact for the latest applied label (or --label / --id).',
        'Feedback loop: suggest-rules (--write/--output) → rule-impact mark --label <id> → show / digest / dashboard.',
      ],
      options: [
        ['mark', 'Subcommand: record an applied rule + baseline'],
        ['--label <id>', 'Rule label (required for mark; optional selector for show)'],
        ['--id <n>', 'Select application by id (show)'],
        ['--category <name>', 'Filter category (repeatable; mark + counting)'],
        ['--agent <id>', 'Filter agent (repeatable)'],
        ['--module <path>', 'Filter module prefix as in report (repeatable)'],
        [`--depth <1-${MAX_DEPTH}>`, `Module depth for --module (default: ${DEFAULT_DEPTH})`],
        ['--at <YYYY-MM-DD|ISO>', 'Applied-at timestamp for mark (default: now)'],
        [`--before-days <n>`, `Days in the before window (default: ${DEFAULT_WINDOW_DAYS})`],
        [`--after-days <n>`, `Days in the after window (default: ${DEFAULT_WINDOW_DAYS})`],
        ['--json', 'Print comparison as JSON'],
      ],
    }),
    run: async (args, io) => {
      const isMark = args[0] === 'mark';
      const rest = isMark ? args.slice(1) : args;
      let values;
      try {
        values = parseArgs({
          args: [...rest],
          options: {
            label: { type: 'string' },
            id: { type: 'string' },
            category: { type: 'string', multiple: true },
            agent: { type: 'string', multiple: true },
            module: { type: 'string', multiple: true },
            depth: { type: 'string' },
            at: { type: 'string' },
            'before-days': { type: 'string' },
            'after-days': { type: 'string' },
            json: { type: 'boolean' },
          },
          strict: true,
          allowPositionals: false,
        }).values;
      } catch (error) {
        io.stderr(`nightowl rule-impact: ${errorMessage(error)}\n`);
        return 1;
      }

      if (isMark) {
        const label = values.label?.trim();
        if (label === undefined || label.length === 0) {
          io.stderr('nightowl rule-impact: mark requires --label <id>\n');
          return 1;
        }
        if (values.id !== undefined || values.json === true || values['before-days'] !== undefined || values['after-days'] !== undefined) {
          io.stderr('nightowl rule-impact: mark does not accept --id, --json, --before-days, or --after-days\n');
          return 1;
        }
        for (const c of values.category ?? []) {
          if (!CATEGORY_NAMES.has(c)) {
            io.stderr(`nightowl rule-impact: unknown --category: ${c}\n`);
            return 1;
          }
        }
        for (const a of values.agent ?? []) {
          if (!isAnyAgentId(a)) {
            io.stderr(`nightowl rule-impact: unknown --agent id: ${a} (known: ${AGENT_IDS.join(', ')}, unknown)\n`);
            return 1;
          }
        }
        const depth = values.depth === undefined ? DEFAULT_DEPTH : Number(values.depth);
        if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) {
          io.stderr(`nightowl rule-impact: --depth must be a whole number from 1 to ${MAX_DEPTH}\n`);
          return 1;
        }
        const appliedAt = parseAppliedAt(values.at, deps.now());
        if (typeof appliedAt === 'object') {
          io.stderr(`nightowl rule-impact: ${appliedAt.error}\n`);
          return 1;
        }

        const store = await openExistingStoreForWrite(deps.cwd());
        if (typeof store === 'string') {
          io.stderr(`nightowl rule-impact: ${store}\n`);
          return 1;
        }
        try {
          const filters = {
            categories: (values.category ?? []).length === 0 ? null : values.category!,
            agents: (values.agent ?? []).length === 0 ? null : values.agent!,
            modules: (values.module ?? []).length === 0 ? null : values.module!,
            depth,
          };
          const baseline = store.countFailuresInWindow({
            ...filters,
            fromInclusive: null,
            toExclusive: appliedAt,
          });
          const saved = store.upsertRuleApplication({
            label,
            appliedAt,
            filters,
            baseline,
          });
          io.stdout(
            `Marked rule "${saved.label}" applied_at=${saved.appliedAt} baseline_total=${saved.baseline.total} (id=${saved.id})\n`,
          );
          io.stderr(ruleLoopNextStepsAfterMark());
          return 0;
        } catch (error) {
          io.stderr(`nightowl rule-impact: ${printable(errorMessage(error))}\n`);
          return 1;
        } finally {
          store.close();
        }
      }

      if (
        values.at !== undefined ||
        values.depth !== undefined ||
        (values.category?.length ?? 0) > 0 ||
        (values.agent?.length ?? 0) > 0 ||
        (values.module?.length ?? 0) > 0
      ) {
        io.stderr(
          'nightowl rule-impact: show uses filters stored on the mark; do not pass --category/--agent/--module/--depth/--at\n',
        );
        return 1;
      }
      const beforeDays = parseDays(values['before-days'], '--before-days');
      if (typeof beforeDays === 'string') {
        io.stderr(`nightowl rule-impact: ${beforeDays}\n`);
        return 1;
      }
      const afterDays = parseDays(values['after-days'], '--after-days');
      if (typeof afterDays === 'string') {
        io.stderr(`nightowl rule-impact: ${afterDays}\n`);
        return 1;
      }
      if (values.label !== undefined && values.id !== undefined) {
        io.stderr('nightowl rule-impact: use either --label or --id, not both\n');
        return 1;
      }

      const store = await openExistingStore(deps.cwd());
      if (typeof store === 'string') {
        io.stderr(`nightowl rule-impact: ${store}\n`);
        return 1;
      }
      try {
        let application =
          values.label !== undefined
            ? store.getRuleApplicationByLabel(values.label.trim())
            : store.getLatestRuleApplication();
        if (values.id !== undefined) {
          const id = Number(values.id);
          if (!Number.isInteger(id) || id < 1) {
            io.stderr('nightowl rule-impact: --id must be a positive integer\n');
            return 1;
          }
          application = store.getRuleApplicationById(id);
        }
        if (application === null) {
          io.stderr("nightowl rule-impact: no rule application found. Run 'nightowl rule-impact mark --label <id>' first.\n");
          return 1;
        }
        const comparison = compareRuleImpact(store, application, {
          beforeDays,
          afterDays,
          now: deps.now().toISOString(),
        });
        io.stdout(values.json === true ? formatImpactJson(comparison) : formatImpactText(comparison));
        return 0;
      } catch (error) {
        io.stderr(`nightowl rule-impact: ${printable(errorMessage(error))}\n`);
        return 1;
      } finally {
        store.close();
      }
    },
  };
}

export const ruleImpactCommand = createRuleImpactCommand();
