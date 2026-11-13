import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

export interface TarFile {
  readonly name: string;
  readonly content: string | Buffer;
}

function encodeOctal(value: number, length: number): string {
  const body = value.toString(8);
  return body.padStart(length - 1, '0').slice(-(length - 1)) + '\0';
}

function checksumHeader(header: Buffer): number {
  let sum = 0;
  for (let i = 0; i < header.length; i += 1) sum += header[i]!;
  return sum;
}

/** Build a single ustar header block (512 bytes). */
export function tarHeader(name: string, size: number, mtimeSec: number): Buffer {
  if (name.length > 100) throw new Error(`tar entry name too long: ${name}`);
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, 'utf8');
  header.write(encodeOctal(0o644, 8), 100, 8, 'utf8');
  header.write(encodeOctal(0, 8), 108, 8, 'utf8');
  header.write(encodeOctal(0, 8), 116, 8, 'utf8');
  header.write(encodeOctal(size, 12), 124, 12, 'utf8');
  header.write(encodeOctal(mtimeSec, 12), 136, 12, 'utf8');
  header.write('        ', 148, 8, 'utf8'); // checksum placeholder (spaces)
  header.write('0', 156, 1, 'utf8');
  header.write('ustar\0', 257, 6, 'utf8');
  header.write('00', 263, 2, 'utf8');
  const sum = checksumHeader(header);
  header.write(encodeOctal(sum, 8), 148, 8, 'utf8');
  return header;
}

function padToBlock(size: number): number {
  const rem = size % 512;
  return rem === 0 ? 0 : 512 - rem;
}

/** Serialize files to an in-memory ustar archive (two trailing zero blocks). */
export function buildTar(files: readonly TarFile[], mtimeSec = Math.floor(Date.now() / 1000)): Buffer {
  const chunks: Buffer[] = [];
  for (const file of files) {
    const body = typeof file.content === 'string' ? Buffer.from(file.content, 'utf8') : file.content;
    chunks.push(tarHeader(file.name, body.length, mtimeSec));
    chunks.push(body);
    const pad = padToBlock(body.length);
    if (pad > 0) chunks.push(Buffer.alloc(pad, 0));
  }
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

/** Write a gzip-compressed ustar archive to `archivePath`. */
export async function writeTarGz(archivePath: string, files: readonly TarFile[]): Promise<void> {
  await mkdir(dirname(archivePath), { recursive: true });
  const tar = buildTar(files);
  await pipeline(Readable.from([tar]), createGzip(), createWriteStream(archivePath));
}
