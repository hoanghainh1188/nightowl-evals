import type { Command } from './command.js';
import { exportCommand } from './export.js';
import { initCommand } from './init.js';
import { failuresCommand } from './failures.js';
import { logCommand } from './log.js';
import { postcommitCommand } from './postcommit.js';
import { precommitCommand } from './precommit.js';
import { reportCommand } from './report.js';

export const commands: readonly Command[] = Object.freeze([
  initCommand,
  logCommand,
  reportCommand,
  exportCommand,
  precommitCommand,
  postcommitCommand,
  failuresCommand,
]);
