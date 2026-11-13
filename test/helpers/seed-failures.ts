import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../../src/storage/store.js';

export interface SeedFailure {
  readonly filePath?: string;
  readonly category?: string | null;
  readonly status?: 'flagged' | 'confirmed' | 'dismissed';
  readonly createdAt?: string;
  readonly aiContent?: string;
  readonly finalContent?: string;
  readonly commitSha?: string | null;
  readonly prompt?: string | null;
  readonly reason?: string | null;
  readonly confidence?: number | null;
  readonly source?: 'manual-fix' | 'ai-self-fix';
  readonly feedback?: string | null;
  readonly agent?: string | null;
  readonly noiseScore?: number | null;
  readonly noiseReasons?: string;
}

export interface SeedCheck {
  readonly createdAt: string;
  readonly outcome: 'failure' | 'not-a-failure' | 'superseded';
  readonly agent?: string | null;
  /** Path on the check event; omit for default `x.ts`, set null/'' for unscoped checks. */
  readonly filePath?: string | null;
}

// Writes rows straight into the database with chosen dates, statuses and categories.
export async function seed(root: string, failures: readonly SeedFailure[], checks: readonly SeedCheck[] = []): Promise<number[]> {
  (await openStore({ cwd: root })).close();
  const db = new DatabaseSync(join(root, '.nightowl', 'nightowl.db'));
  try {
    const event = db.prepare(
      `INSERT INTO events (created_at, source, kind, session_id, file_path, payload, agent) VALUES (?, ?, ?, 's', ?, ?, ?) RETURNING id`,
    );
    const failure = db.prepare(
      `INSERT INTO failures (created_at, file_path, ai_event_id, prompt_event_id, ai_content, final_content, commit_sha,
         category, category_reason, category_confidence, status, source, feedback_event_id, agent, noise_score, noise_reasons)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    );
    const ids: number[] = [];
    for (const f of failures) {
      const createdAt = f.createdAt ?? '2026-11-04T10:00:00.000Z';
      const filePath = f.filePath ?? 'src/a.ts';
      const agent = f.agent === undefined ? 'claude-code' : f.agent;
      const prompt =
        f.prompt === undefined || f.prompt === null
          ? null
          : (event.get(createdAt, 'agent-hook', 'prompt', null, JSON.stringify({ prompt: f.prompt }), agent) as { id: number }).id;
      const edit = (event.get(createdAt, 'agent-hook', 'edit', filePath, '{}', agent) as { id: number }).id;
      const feedback =
        f.feedback === undefined || f.feedback === null
          ? null
          : (event.get(createdAt, 'agent-hook', 'prompt', null, JSON.stringify({ prompt: f.feedback }), agent) as { id: number }).id;
      const row = failure.get(
        createdAt,
        filePath,
        edit,
        prompt,
        f.aiContent ?? 'ai\n',
        f.finalContent ?? 'dev\n',
        f.commitSha === undefined ? 'abcdef0123456789' : f.commitSha,
        f.category ?? null,
        f.reason ?? null,
        f.confidence ?? null,
        f.status ?? 'flagged',
        f.source ?? 'manual-fix',
        feedback,
        agent,
        f.noiseScore ?? null,
        f.noiseReasons ?? '',
      ) as { id: number };
      ids.push(row.id);
    }
    const attach = db.prepare('INSERT INTO checks_attached (check_id, outcome) VALUES (?, ?)');
    for (const c of checks) {
      const checkPath = c.filePath === undefined ? 'x.ts' : c.filePath;
      const id = (
        event.get(c.createdAt, 'git', 'commit-check', checkPath, '{}', c.agent ?? 'claude-code') as { id: number }
      ).id;
      attach.run(id, c.outcome);
    }
    return ids;
  } finally {
    db.close();
  }
}
