import type { ReviewFilter, FailureForReview, FailureStatus } from '../../storage/review-queries.js';
import type { Store } from '../../storage/store.js';
import { SHOW_CURSOR, RESET } from './ansi.js';
import { consumeKey, type TuiKey } from './keys.js';
import { renderFrame, type TuiViewState } from './render.js';

export type MarkAction = 'confirm' | 'dismiss' | 'reset';

const MARK_STATUS: Readonly<Record<MarkAction, FailureStatus>> = Object.freeze({
  confirm: 'confirmed',
  dismiss: 'dismissed',
  reset: 'flagged',
});

export interface TuiState {
  readonly items: readonly FailureForReview[];
  readonly index: number;
  readonly showDiff: boolean;
  readonly statusLabel: string | null;
  readonly message: string | null;
  readonly done: boolean;
}

export interface TuiTerminal {
  readonly isTTY: boolean;
  readonly rows: number;
  readonly columns: number;
  readonly write: (text: string) => void;
  readonly setRawMode: (enabled: boolean) => void;
  readonly onData: (handler: (chunk: string) => void) => () => void;
}

export function initialTuiState(
  items: readonly FailureForReview[],
  statusLabel: string | null,
): TuiState {
  return Object.freeze({
    items,
    index: 0,
    showDiff: false,
    statusLabel,
    message: null,
    done: false,
  });
}

export function applyKey(state: TuiState, key: TuiKey): TuiState {
  if (state.done) return state;
  switch (key.type) {
    case 'quit':
      return Object.freeze({ ...state, done: true, message: null });
    case 'up':
      if (state.items.length === 0) return state;
      return Object.freeze({
        ...state,
        index: Math.max(0, state.index - 1),
        showDiff: false,
        message: null,
      });
    case 'down':
      if (state.items.length === 0) return state;
      return Object.freeze({
        ...state,
        index: Math.min(state.items.length - 1, state.index + 1),
        showDiff: false,
        message: null,
      });
    case 'toggleDiff':
      if (state.items.length === 0) return state;
      return Object.freeze({ ...state, showDiff: !state.showDiff, message: null });
    case 'unknown':
      return state;
    default:
      return state;
  }
}

export function applyMarkResult(
  state: TuiState,
  nextItems: readonly FailureForReview[],
  message: string,
): TuiState {
  const index = nextItems.length === 0 ? 0 : Math.min(state.index, nextItems.length - 1);
  return Object.freeze({
    ...state,
    items: nextItems,
    index,
    showDiff: false,
    message,
  });
}

function toView(state: TuiState, rows: number, columns: number): TuiViewState {
  return {
    items: state.items,
    index: state.index,
    showDiff: state.showDiff,
    statusLabel: state.statusLabel,
    message: state.message,
    rows,
    columns,
  };
}

export async function runInteractiveReview(
  store: Store,
  filter: ReviewFilter,
  statusLabel: string | null,
  terminal: TuiTerminal,
): Promise<number> {
  if (!terminal.isTTY) return 1;

  let state = initialTuiState(store.listFailuresForReview(filter), statusLabel);
  let buffer = '';
  let settled = false;

  const paint = () => {
    terminal.write(renderFrame(toView(state, terminal.rows, terminal.columns)));
  };

  const cleanup = () => {
    if (settled) return;
    settled = true;
    try {
      terminal.setRawMode(false);
    } catch {
      // Best effort on platforms that reject setRawMode.
    }
    terminal.write(`${SHOW_CURSOR}${RESET}\n`);
  };

  return await new Promise<number>((resolve) => {
    const finish = (code: number) => {
      cleanup();
      resolve(code);
    };

    try {
      terminal.setRawMode(true);
    } catch {
      finish(1);
      return;
    }

    paint();

    const unsubscribe = terminal.onData((chunk) => {
      if (settled) return;
      buffer += chunk;
      for (;;) {
        const parsed = consumeKey(buffer);
        if (parsed === null) break;
        buffer = parsed.rest;
        const key = parsed.key;

        if (key.type === 'confirm' || key.type === 'dismiss' || key.type === 'reset') {
          if (state.items.length === 0) continue;
          const current = state.items[state.index]!;
          const status = MARK_STATUS[key.type];
          const result = store.setFailureStatus([current.id], status);
          if (!result.ok) {
            state = Object.freeze({ ...state, message: `no failure #${current.id}` });
            paint();
            continue;
          }
          const nextItems = store.listFailuresForReview(filter);
          const verb = key.type === 'confirm' ? 'Confirmed' : key.type === 'dismiss' ? 'Dismissed' : 'Reset';
          state = applyMarkResult(state, nextItems, `${verb} #${current.id}`);
          paint();
          continue;
        }

        state = applyKey(state, key);
        if (state.done) {
          unsubscribe();
          finish(0);
          return;
        }
        if (key.type !== 'unknown') paint();
      }
    });
  });
}

export function processStdinTerminal(
  stdin: NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void },
  stdout: NodeJS.WriteStream,
): TuiTerminal {
  return {
    isTTY: stdin.isTTY === true && stdout.isTTY === true,
    rows: stdout.rows ?? 24,
    columns: stdout.columns ?? 80,
    write: (text) => {
      stdout.write(text);
    },
    setRawMode: (enabled) => {
      if (typeof stdin.setRawMode === 'function') stdin.setRawMode(enabled);
    },
    onData: (handler) => {
      const onData = (chunk: string | Buffer) => {
        handler(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
      };
      stdin.setEncoding('utf8');
      stdin.on('data', onData);
      return () => {
        stdin.off('data', onData);
      };
    },
  };
}
