import { classifyCommand } from './classify.js';
import type { Command } from './command.js';
import { doctorCommand } from './doctor.js';
import { evalCommand } from './eval.js';
import { exportCommand } from './export.js';
import { initCommand } from './init.js';
import { failuresCommand } from './failures.js';
import { logCommand } from './log.js';
import { postcommitCommand } from './postcommit.js';
import { precommitCommand } from './precommit.js';
import { pruneCommand } from './prune.js';
import { reportCommand } from './report.js';
import { reviewCommand } from './review.js';
import { suggestRegressionsCommand } from './suggest-regressions.js';
import { suggestRulesCommand } from './suggest-rules.js';
import { uninstallCommand } from './uninstall.js';

export const commands: readonly Command[] = Object.freeze([
  initCommand,
  doctorCommand,
  logCommand,
  reportCommand,
  exportCommand,
  precommitCommand,
  postcommitCommand,
  pruneCommand,
  failuresCommand,
  classifyCommand,
  evalCommand,
  reviewCommand,
  suggestRulesCommand,
  suggestRegressionsCommand,
  uninstallCommand,
]);
