import type { CiFailRecord } from './junit.js';

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Minimal CI JSON summary: `{ "failures": [ { "file", "message", "name?", "commit?", "classname?", "suite?" } ] }`. */
export function parseCiJson(raw: string, commitSha: string | null = null): readonly CiFailRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('CI JSON is not valid JSON');
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as { failures?: unknown }).failures)
      ? (parsed as { failures: unknown[] }).failures
      : null;
  if (list === null) throw new Error('CI JSON must be an array or an object with a "failures" array');

  const records: CiFailRecord[] = [];
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const message = asString(row.message) ?? asString(row.error);
    const name = asString(row.name) ?? asString(row.test) ?? asString(row.test_name);
    const file = asString(row.file) ?? asString(row.file_path) ?? asString(row.path);
    if (message === null && name === null && file === null) continue;
    records.push({
      filePath: file,
      testName: name,
      classname: asString(row.classname) ?? asString(row.class_name),
      suite: asString(row.suite) ?? asString(row.testsuite),
      message,
      commitSha: asString(row.commit) ?? asString(row.commit_sha) ?? commitSha,
    });
  }
  return Object.freeze(records);
}
