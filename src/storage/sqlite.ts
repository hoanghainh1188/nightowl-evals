type SqliteModule = typeof import('node:sqlite');

let loading: Promise<SqliteModule> | undefined;

export function isSqliteExperimentalWarning(warning: string | Error, args: readonly unknown[]): boolean {
  const message = typeof warning === 'string' ? warning : warning.message;
  const [option] = args;
  const type =
    typeof option === 'string'
      ? option
      : typeof option === 'object' && option !== null && 'type' in option
        ? option.type
        : typeof warning === 'string'
          ? undefined
          : warning.name;
  return type === 'ExperimentalWarning' && message.includes('SQLite');
}

// `node:sqlite` emits an ExperimentalWarning on load (Node 22 and 24). Hooks must stay
// silent, so drop exactly that warning while the module loads, then restore emitWarning.
async function importQuietly(): Promise<SqliteModule> {
  const original = process.emitWarning;
  const filtered = (warning: string | Error, ...args: unknown[]): void => {
    if (isSqliteExperimentalWarning(warning, args)) return;
    (original as (warning: string | Error, ...rest: unknown[]) => void).call(process, warning, ...args);
  };
  process.emitWarning = filtered as typeof process.emitWarning;
  try {
    return await import('node:sqlite');
  } finally {
    process.emitWarning = original;
  }
}

export function loadSqlite(): Promise<SqliteModule> {
  loading ??= importQuietly();
  return loading;
}
