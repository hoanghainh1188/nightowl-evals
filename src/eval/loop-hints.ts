/** Stderr copy after successful `export` write (offline). */
export function evalLoopNextStepsAfterExport(suitePathShown: string): string {
  return [
    'Next: run the suite locally with a label, then review on digest/dashboard:',
    `  nightowl eval --input ${suitePathShown} --label <id> --yes`,
    'Then: nightowl eval-compare (optional --baseline) or nightowl digest or nightowl dashboard',
    '',
  ].join('\n');
}

/** Stderr copy after successful suggest-regressions write (offline). */
export function evalLoopNextStepsAfterSuggest(): string {
  return [
    'Next: turn confirmed failures into a suite, then eval with a label:',
    '  nightowl export --status confirmed',
    '  nightowl eval --label <id> --yes',
    'Then: nightowl digest or nightowl dashboard',
    '',
  ].join('\n');
}

/** Stderr copy after successful `eval --yes` run save (offline). */
export function evalLoopNextStepsAfterEval(): string {
  return [
    'Next: compare to a prior run and/or open the weekly surfaces:',
    '  nightowl eval-compare --baseline <prior-run.jsonl>',
    '  nightowl digest   # or: nightowl dashboard',
    '',
  ].join('\n');
}
