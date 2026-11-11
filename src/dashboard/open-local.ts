import { spawn, type SpawnOptions } from 'node:child_process';

export type OpenLocalSpawn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => { readonly unref: () => void };

export interface OpenLocalPathOptions {
  readonly platform?: NodeJS.Platform;
  readonly spawn?: OpenLocalSpawn;
}

function commandFor(platform: NodeJS.Platform, absolutePath: string): { command: string; args: string[] } {
  if (platform === 'darwin') {
    return { command: 'open', args: [absolutePath] };
  }
  if (platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'start', '', absolutePath] };
  }
  return { command: 'xdg-open', args: [absolutePath] };
}

/** Opens a local file with the OS default handler. Never starts an HTTP server. */
export function openLocalPath(absolutePath: string, options: OpenLocalPathOptions = {}): void {
  const platform = options.platform ?? process.platform;
  const run = options.spawn ?? ((cmd, argv, opts) => spawn(cmd, [...argv], opts));
  const { command, args } = commandFor(platform, absolutePath);
  const child = run(command, args, { stdio: 'ignore', detached: true });
  child.unref();
}

export function openCommandForPlatform(platform: NodeJS.Platform, absolutePath: string) {
  return commandFor(platform, absolutePath);
}
