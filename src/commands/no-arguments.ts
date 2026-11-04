import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import type { Io } from '../cli/io.js';
import { printable } from '../shared/printable.js';

// For commands that take no options: reports any argument and returns false, before anything is touched.
export function acceptsNoArguments(name: string, args: readonly string[], io: Io): boolean {
  try {
    parseArgs({ args: [...args], options: {}, strict: true, allowPositionals: false });
    return true;
  } catch (error) {
    io.stderr(`nightowl ${name}: ${printable(errorMessage(error))}\nRun 'nightowl ${name} --help'.\n`);
    return false;
  }
}
