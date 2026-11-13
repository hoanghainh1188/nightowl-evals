import { classifyCommand } from './classify.js';
import type { Command } from './command.js';
import { completionCommand } from './completion.js';
import { doctorCommand } from './doctor.js';
import { evalCommand } from './eval.js';
import { evalCompareCommand } from './eval-compare.js';
import { exportCommand } from './export.js';
import { initCommand } from './init.js';
import { failuresCommand } from './failures.js';
import { ingestCiCommand } from './ingest-ci.js';
import { ingestPrCommand } from './ingest-pr.js';
import { ingestRevertCommand } from './ingest-revert.js';
import { logCommand } from './log.js';
import { postcommitCommand } from './postcommit.js';
import { precommitCommand } from './precommit.js';
import { pruneCommand } from './prune.js';
import { customerReportCommand } from './customer-report.js';
import { dashboardCommand } from './dashboard.js';
import { digestCommand } from './digest.js';
import { reportCommand } from './report.js';
import { reviewCommand } from './review.js';
import { ruleImpactCommand } from './rule-impact.js';
import { sharePackCommand } from './share-pack.js';
import { suggestRegressionsCommand } from './suggest-regressions.js';
import { suggestRulesCommand } from './suggest-rules.js';
import { uninstallCommand } from './uninstall.js';

export const commands: readonly Command[] = Object.freeze([
  initCommand,
  doctorCommand,
  logCommand,
  reportCommand,
  customerReportCommand,
  dashboardCommand,
  digestCommand,
  sharePackCommand,
  exportCommand,
  ingestCiCommand,
  ingestPrCommand,
  ingestRevertCommand,
  precommitCommand,
  postcommitCommand,
  pruneCommand,
  failuresCommand,
  classifyCommand,
  evalCommand,
  evalCompareCommand,
  reviewCommand,
  suggestRulesCommand,
  suggestRegressionsCommand,
  ruleImpactCommand,
  uninstallCommand,
  completionCommand,
]);
