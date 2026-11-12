import type { Report } from '../report/build.js';
import { coarsenPath } from './redact.js';

function coarsenModuleLabel(module: string): string {
  if (module === '(root)') return module;
  return coarsenPath(module);
}

/** Returns a copy of the report with module/path labels coarsened for share-out views. */
export function redactPathsInReport(report: Report): Report {
  return Object.freeze({
    ...report,
    byModule: Object.freeze(
      report.byModule.map((row) =>
        Object.freeze({
          module: coarsenModuleLabel(row.module),
          failures: row.failures,
        }),
      ),
    ),
    clusters: Object.freeze(
      report.clusters.map((c) =>
        Object.freeze({
          ...c,
          module: coarsenModuleLabel(c.module),
          samplePaths: Object.freeze(c.samplePaths.map((p) => coarsenPath(p))),
        }),
      ),
    ),
  });
}
