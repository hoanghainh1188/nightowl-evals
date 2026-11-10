import type { DatabaseSync } from 'node:sqlite';

export interface RuleApplicationFilters {
  readonly categories: readonly string[] | null;
  readonly agents: readonly string[] | null;
  readonly modules: readonly string[] | null;
  readonly depth: number;
}

export interface RuleBaseline {
  readonly total: number;
  readonly byCategory: Readonly<Record<string, number>>;
}

export interface RuleApplication {
  readonly id: number;
  readonly createdAt: string;
  readonly appliedAt: string;
  readonly label: string;
  readonly filters: RuleApplicationFilters;
  readonly baseline: RuleBaseline;
}

export interface UpsertRuleApplicationInput {
  readonly label: string;
  readonly appliedAt: string;
  readonly createdAt?: string;
  readonly filters: RuleApplicationFilters;
  readonly baseline: RuleBaseline;
}

interface Row {
  id: number;
  created_at: string;
  applied_at: string;
  label: string;
  categories: string | null;
  agents: string | null;
  modules: string | null;
  depth: number;
  baseline: string;
}

function parseJsonArray(raw: string | null): readonly string[] | null {
  if (raw === null) return null;
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return null;
  return Object.freeze(parsed.filter((v): v is string => typeof v === 'string'));
}

function toApplication(row: Row): RuleApplication {
  const baseline = JSON.parse(row.baseline) as { total?: unknown; by_category?: unknown; byCategory?: unknown };
  const byCategoryRaw =
    baseline.by_category !== undefined && typeof baseline.by_category === 'object' && baseline.by_category !== null
      ? (baseline.by_category as Record<string, number>)
      : baseline.byCategory !== undefined && typeof baseline.byCategory === 'object' && baseline.byCategory !== null
        ? (baseline.byCategory as Record<string, number>)
        : {};
  return Object.freeze({
    id: row.id,
    createdAt: row.created_at,
    appliedAt: row.applied_at,
    label: row.label,
    filters: Object.freeze({
      categories: parseJsonArray(row.categories),
      agents: parseJsonArray(row.agents),
      modules: parseJsonArray(row.modules),
      depth: row.depth,
    }),
    baseline: Object.freeze({
      total: typeof baseline.total === 'number' ? baseline.total : 0,
      byCategory: Object.freeze({ ...byCategoryRaw }),
    }),
  });
}

function jsonOrNull(values: readonly string[] | null): string | null {
  return values === null || values.length === 0 ? null : JSON.stringify(values);
}

function asRow(value: unknown): Row {
  return value as Row;
}

function asRows(value: unknown): Row[] {
  return value as Row[];
}

export function upsertRuleApplication(db: DatabaseSync, input: UpsertRuleApplicationInput): RuleApplication {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const baselineJson = JSON.stringify({
    total: input.baseline.total,
    by_category: input.baseline.byCategory,
  });
  db.prepare(
    `INSERT INTO rule_applications (created_at, applied_at, label, categories, agents, modules, depth, baseline)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(label) DO UPDATE SET
       created_at = excluded.created_at,
       applied_at = excluded.applied_at,
       categories = excluded.categories,
       agents = excluded.agents,
       modules = excluded.modules,
       depth = excluded.depth,
       baseline = excluded.baseline`,
  ).run(
    createdAt,
    input.appliedAt,
    input.label,
    jsonOrNull(input.filters.categories),
    jsonOrNull(input.filters.agents),
    jsonOrNull(input.filters.modules),
    input.filters.depth,
    baselineJson,
  );
  return toApplication(asRow(db.prepare('SELECT * FROM rule_applications WHERE label = ?').get(input.label)));
}

export function getRuleApplicationById(db: DatabaseSync, id: number): RuleApplication | null {
  const row = db.prepare('SELECT * FROM rule_applications WHERE id = ?').get(id);
  return row === undefined ? null : toApplication(asRow(row));
}

export function getRuleApplicationByLabel(db: DatabaseSync, label: string): RuleApplication | null {
  const row = db.prepare('SELECT * FROM rule_applications WHERE label = ?').get(label);
  return row === undefined ? null : toApplication(asRow(row));
}

export function getLatestRuleApplication(db: DatabaseSync): RuleApplication | null {
  const row = db.prepare('SELECT * FROM rule_applications ORDER BY applied_at DESC, id DESC LIMIT 1').get();
  return row === undefined ? null : toApplication(asRow(row));
}

export function listRuleApplications(db: DatabaseSync): readonly RuleApplication[] {
  const rows = asRows(db.prepare('SELECT * FROM rule_applications ORDER BY applied_at DESC, id DESC').all());
  return Object.freeze(rows.map(toApplication));
}
