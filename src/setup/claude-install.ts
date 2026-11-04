import { GitError, runGit } from '../hooks/git/run-git.js';
import {
  assertNotSymlinked,
  ensureClaudeHooks,
  type EnsureResult,
  hasNightowlHooks,
  mergeClaudeHooks,
  PERSONAL_SETTINGS,
  readSettings,
  SHARED_SETTINGS,
  type SettingsFile,
  upgradeClaudeHooks,
  withPath,
} from './claude-settings.js';
import { SetupError } from './fs-utils.js';
import { ensureGitignoreEntry, type FileChange } from './gitignore.js';

export class PersonalSettingsTrackedError extends SetupError {
  constructor() {
    super(`${PERSONAL_SETTINGS} is committed to git, so hooks written there would be shared. Use 'nightowl init --shared' instead.`);
    this.name = 'PersonalSettingsTrackedError';
  }
}

export type InstallOutcome =
  | {
      readonly kind: 'installed';
      readonly file: SettingsFile;
      readonly result: EnsureResult;
      readonly gitignore: FileChange;
      // The other settings file also holds NightOwl hooks, so every event is recorded twice.
      readonly alsoIn: SettingsFile | null;
    }
  // NightOwl hooks already live in the other file; nothing was added.
  | { readonly kind: 'elsewhere'; readonly file: SettingsFile; readonly upgraded: number };

interface Plan {
  readonly install: boolean;
  readonly other: SettingsFile;
  readonly inOther: boolean;
}

async function gitSucceeds(root: string, args: readonly string[]): Promise<boolean> {
  try {
    await runGit(args, { cwd: root });
    return true;
  } catch (error) {
    if (error instanceof GitError && error.exitCode === 1) return false;
    const reason = error instanceof Error ? error.message : String(error);
    throw new SetupError(`could not check ${PERSONAL_SETTINGS} with git (${reason})`);
  }
}

const isIgnored = (root: string) => gitSucceeds(root, ['check-ignore', '-q', '--', PERSONAL_SETTINGS]);

// The personal file must never reach a commit; a tracked one is refused in checkClaudeHooks.
async function keepPersonalFileOutOfGit(root: string): Promise<FileChange> {
  if (await isIgnored(root)) return 'unchanged';
  const change = await ensureGitignoreEntry(root, PERSONAL_SETTINGS);
  // A later rule such as `!.claude/settings.local.json` can still re-include it.
  if (!(await isIgnored(root))) {
    throw new SetupError(`${PERSONAL_SETTINGS} is still not ignored by git: a .gitignore rule re-includes it. Fix that rule, or use 'nightowl init --shared'.`);
  }
  return change;
}

const otherFile = (file: SettingsFile): SettingsFile => (file === PERSONAL_SETTINGS ? SHARED_SETTINGS : PERSONAL_SETTINGS);

// Reads and checks everything init would change, before anything is written.
export async function checkClaudeHooks(root: string, file: SettingsFile): Promise<Plan> {
  const other = otherFile(file);
  const [target, elsewhere] = await Promise.all([readSettings(root, file), readSettings(root, other)]);
  const otherUpgrade = withPath(elsewhere.path, () => upgradeClaudeHooks(elsewhere.value));
  const inOther = hasNightowlHooks(elsewhere.value);
  if (otherUpgrade.upgraded > 0) await assertNotSymlinked(root, other);
  // Claude Code runs the hooks of both settings files, so NightOwl's must live in only one.
  if (inOther && !hasNightowlHooks(target.value)) return { install: false, other, inOther };

  const merged = withPath(target.path, () => mergeClaudeHooks(target.value));
  if (merged.added.length > 0 || merged.upgraded > 0) await assertNotSymlinked(root, file);
  if (file === PERSONAL_SETTINGS && (await gitSucceeds(root, ['ls-files', '--error-unmatch', '--', PERSONAL_SETTINGS]))) {
    throw new PersonalSettingsTrackedError();
  }
  return { install: true, other, inOther };
}

export async function installClaudeHooks(root: string, file: SettingsFile): Promise<InstallOutcome> {
  const plan = await checkClaudeHooks(root, file);
  if (!plan.install) {
    const { upgraded } = await ensureClaudeHooks(root, plan.other, true);
    return { kind: 'elsewhere', file: plan.other, upgraded };
  }

  const gitignore = file === PERSONAL_SETTINGS ? await keepPersonalFileOutOfGit(root) : 'unchanged';
  const result = await ensureClaudeHooks(root, file);
  if (plan.inOther) await ensureClaudeHooks(root, plan.other, true);
  return { kind: 'installed', file, result, gitignore, alsoIn: plan.inOther ? plan.other : null };
}
