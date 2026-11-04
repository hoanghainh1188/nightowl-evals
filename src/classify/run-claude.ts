import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INTERNAL_ENV } from '../shared/internal-env.js';
import { CLASSIFICATION_SCHEMA } from './parse.js';

export const CLAUDE_TIMEOUT_MS = 120_000;
const MAX_STDOUT_BYTES = 1024 * 1024;

export interface RunClaudeOptions {
  readonly model: string;
  readonly timeoutMs?: number;
  readonly env?: NodeJS.ProcessEnv;
}

export type RunClaude = (prompt: string, options: RunClaudeOptions) => Promise<string>;

export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly reason: 'not_found' | 'timeout' | 'exit',
  ) {
    super(message);
    this.name = 'ClaudeError';
  }
}

export function claudeArgs(model: string): readonly string[] {
  return [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(CLASSIFICATION_SCHEMA),
    // No tools: the model only sees what NightOwl sends.
    '--tools',
    '',
    '--no-session-persistence',
    '--model',
    model,
  ];
}

function spawnClaude(prompt: string, options: RunClaudeOptions, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', [...claudeArgs(options.model)], {
      cwd,
      env: { ...(options.env ?? process.env), [INTERNAL_ENV]: '1' },
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    // Kill and give up at once: a grandchild may keep stdout open long after.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(() => reject(new ClaudeError('claude did not answer in time', 'timeout')));
    }, options.timeoutMs ?? CLAUDE_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_STDOUT_BYTES) chunks.push(chunk);
    });
    child.on('error', (error: NodeJS.ErrnoException) =>
      finish(() =>
        reject(error.code === 'ENOENT' ? new ClaudeError('claude was not found on PATH', 'not_found') : error),
      ),
    );
    child.on('close', (code) =>
      finish(() =>
        code === 0
          ? resolve(Buffer.concat(chunks).toString('utf8'))
          : reject(new ClaudeError(`claude exited with code ${String(code)}`, 'exit')),
      ),
    );
    child.stdin.on('error', () => {
      // claude may exit before reading the prompt; the close handler reports the outcome.
    });
    // The prompt goes through stdin: arguments are visible to other users in `ps`.
    child.stdin.end(prompt);
  });
}

// Runs one non-interactive Claude Code call in an empty temporary directory, so no project
// CLAUDE.md or settings are loaded, and removes the directory afterwards.
export const runClaude: RunClaude = async (prompt, options) => {
  const cwd = await mkdtemp(join(tmpdir(), 'nightowl-classify-'));
  try {
    return await spawnClaude(prompt, options, cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
};
