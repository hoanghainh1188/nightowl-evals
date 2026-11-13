import { gunzipSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildTar, tarHeader } from '../../src/share/tar-gz.js';

describe('tar-gz helper', () => {
  it('writes a readable ustar header and body', () => {
    const header = tarHeader('report.md', 5, 1_700_000_000);
    expect(header).toHaveLength(512);
    expect(header.subarray(0, 9).toString('utf8')).toBe('report.md');
    expect(header.subarray(257, 262).toString('utf8')).toBe('ustar');
  });

  it('builds a tar that contains the file payload', () => {
    const tar = buildTar([{ name: 'a.txt', content: 'hello' }], 1_700_000_000);
    expect(tar.subarray(512, 517).toString('utf8')).toBe('hello');
    expect(tar.subarray(-1024).equals(Buffer.alloc(1024, 0))).toBe(true);
  });

  it('round-trips through gzip', () => {
    const tar = buildTar([{ name: 'm.json', content: '{"ok":true}\n' }]);
    expect(gunzipSync(gzipSync(tar)).equals(tar)).toBe(true);
  });
});
