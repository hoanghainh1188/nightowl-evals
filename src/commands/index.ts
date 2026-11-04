import type { Command } from './command.js';
import { exportCommand } from './export.js';
import { initCommand } from './init.js';
import { logCommand } from './log.js';
import { reportCommand } from './report.js';

export const commands: readonly Command[] = Object.freeze([
  initCommand,
  logCommand,
  reportCommand,
  exportCommand,
]);
