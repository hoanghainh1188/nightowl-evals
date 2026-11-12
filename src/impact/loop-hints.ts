/** Stderr copy after suggest-rules --write/--output (offline; does not mark). */
export function ruleLoopNextStepsAfterSuggest(): string {
  return [
    'Next: after you apply the rules in the project, mark them locally:',
    '  nightowl rule-impact mark --label <id>',
    'Then review: nightowl rule-impact or nightowl digest or nightowl dashboard',
    '',
  ].join('\n');
}

/** Stderr copy after rule-impact mark succeeds. */
export function ruleLoopNextStepsAfterMark(): string {
  return 'Next: nightowl rule-impact (or nightowl digest or nightowl dashboard)\n';
}
