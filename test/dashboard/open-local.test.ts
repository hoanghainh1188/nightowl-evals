import { describe, expect, it, vi } from 'vitest';
import { openCommandForPlatform, openLocalPath } from '../../src/dashboard/open-local.js';

describe('openLocalPath', () => {
  it('selects the right OS command', () => {
    expect(openCommandForPlatform('darwin', '/tmp/d.html')).toEqual({
      command: 'open',
      args: ['/tmp/d.html'],
    });
    expect(openCommandForPlatform('win32', 'C:\\tmp\\d.html')).toEqual({
      command: 'cmd',
      args: ['/c', 'start', '', 'C:\\tmp\\d.html'],
    });
    expect(openCommandForPlatform('linux', '/tmp/d.html')).toEqual({
      command: 'xdg-open',
      args: ['/tmp/d.html'],
    });
  });

  it('spawns detached without binding a TCP server', () => {
    const unref = vi.fn();
    const spawn = vi.fn(() => ({ unref }));
    openLocalPath('/tmp/dashboard.html', { platform: 'darwin', spawn });
    expect(spawn).toHaveBeenCalledWith('open', ['/tmp/dashboard.html'], {
      stdio: 'ignore',
      detached: true,
    });
    expect(unref).toHaveBeenCalled();
    const args = JSON.stringify(spawn.mock.calls);
    expect(args).not.toContain('listen');
    expect(args).not.toContain('createServer');
    expect(args).not.toMatch(/https?:\/\//);
  });
});
