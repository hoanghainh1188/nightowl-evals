import { spawn } from 'node:child_process';

export interface GitOptions {
  readonly cwd: string;
  readonly input?: string | undefined;
  readonly timeoutMs?: number | undefined;
}

export class GitError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly exitCode: number | null,
  ) {
    super(`git ${args[0] ?? ''} failed with exit code ${String(exitCode)}`);
    this.name = 'GitError';
  }
}

// Runs a local git command and returns stdout as raw bytes. stderr is discarded.
export function runGit(args: readonly string[], options: GitOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', [...args], {
      cwd: options.cwd,
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: options.timeoutMs,
    });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new GitError(args, code));
    });
    child.stdin.on('error', () => {
      // git may exit before reading all input; the close handler reports the outcome.
    });
    child.stdin.end(options.input ?? '');
  });
}
