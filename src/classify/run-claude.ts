import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INTERNAL_ENV } from '../shared/internal-env.js';

export const CLAUDE_TIMEOUT_MS = 120_000;
// Enough for a generated file of 512 KB once escaped inside the JSON envelope.
const MAX_STDOUT_BYTES = 4 * 1024 * 1024;

export interface RunClaudeOptions {
  readonly model: string;
  // JSON Schema the answer must follow (passed as --json-schema).
  readonly schema: object;
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

export function claudeArgs(model: string, schema: object): readonly string[] {
  return [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(schema),
    // No built-in tools, no MCP servers, no skills: the model only sees what NightOwl sends
    // and can do nothing but answer, whatever the user's own Claude Code settings allow.
    '--tools',
    '',
    '--strict-mcp-config',
    '--mcp-config',
    '{"mcpServers":{}}',
    '--disable-slash-commands',
    '--permission-mode',
    'dontAsk',
    '--no-session-persistence',
    '--model',
    model,
  ];
}

function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone.
  }
}

function spawnClaude(prompt: string, options: RunClaudeOptions, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', [...claudeArgs(options.model, options.schema)], {
      cwd,
      env: { ...(options.env ?? process.env), [INTERNAL_ENV]: '1' },
      stdio: ['pipe', 'pipe', 'ignore'],
      // Own process group, so a timeout also kills what claude started (MCP servers, hooks).
      detached: true,
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
      killGroup(child.pid);
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
