import { chmod, readFile, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { createTempDir, type TempDir } from './temp-repo.js';

export interface FakeClaude {
  readonly dir: TempDir;
  // PATH with the fake claude first.
  readonly path: string;
  readonly calls: () => Promise<readonly FakeClaudeCall[]>;
}

export interface FakeClaudeCall {
  readonly args: readonly string[];
  readonly internal: string;
  readonly cwd: string;
  readonly stdin: string;
}

// A shell script named `claude` that records each call and prints `stdout` (or runs `body`).
export async function createFakeClaude(output: string | { readonly body: string }): Promise<FakeClaude> {
  const dir = await createTempDir('nightowl-fake-claude-');
  const responses = join(dir.path, 'response.json');
  if (typeof output === 'string') await writeFile(responses, output);
  const body = typeof output === 'string' ? `cat "${responses}"` : output.body;
  const script = `#!/bin/sh
n=$(ls "${dir.path}"/call-*.args 2>/dev/null | wc -l | tr -d ' ')
base="${dir.path}/call-$n"
printf '%s\\n' "$@" > "$base.args"
printf '%s' "$NIGHTOWL_INTERNAL" > "$base.env"
pwd -P > "$base.cwd"
cat > "$base.stdin"
${body}
`;
  await writeFile(join(dir.path, 'claude'), script);
  await chmod(join(dir.path, 'claude'), 0o755);

  return {
    dir,
    path: `${dir.path}${delimiter}/usr/bin${delimiter}/bin`,
    calls: async () => {
      const result: FakeClaudeCall[] = [];
      for (let i = 0; ; i++) {
        const base = join(dir.path, `call-${i}`);
        const args = await readFile(`${base}.args`, 'utf8').catch(() => null);
        if (args === null) return result;
        result.push({
          args: args.replace(/\n$/, '').split('\n'),
          internal: await readFile(`${base}.env`, 'utf8'),
          cwd: (await readFile(`${base}.cwd`, 'utf8')).trim(),
          stdin: await readFile(`${base}.stdin`, 'utf8'),
        });
      }
    },
  };
}
