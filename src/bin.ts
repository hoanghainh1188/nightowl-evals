import { installProcessGuards } from './cli/guards.js';
import { processIo } from './cli/io.js';
import { main } from './cli/main.js';

const argv = process.argv.slice(2);
installProcessGuards(argv, process);
process.exitCode = await main(argv, processIo());
