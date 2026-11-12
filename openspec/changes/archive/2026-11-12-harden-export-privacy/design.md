# Design

## Context

See `proposal.md` — Why. Hook đã có `isSensitivePath` / `containsInlineSecret` / `redactInlineSecrets` trong `src/hooks/claude-code/sensitive.ts`. `export` skip sensitive + inline secret rows. Báo cáo khách/dashboard chủ yếu aggregate; path/module vẫn có thể lộ cấu trúc repo.

## Goals / Non-Goals

**Goals:**
- Module `src/privacy/` (facade) dùng chung: redact secrets (mở rộng pattern), redact emails, coarsen paths, summarize dry-run counts.
- Wire vào `export` (+ dry-run / `--redact-paths`); wire `--redact-paths` vào customer-report / dashboard / digest formatters khi in module/path.
- Tests unit cho privacy + integration export dry-run / redact-paths.

**Non-Goals:**
- Xoá dữ liệu trong SQLite; migration scrub DB.
- LLM-based PII detection; network scanners.
- Full GDPR tooling / consent UI.
- Thay đổi hook ingest (chỉ lớp xuất/hiển thị).

## Decisions

1. **Facade `src/privacy/` re-exports + extends sensitive**
   - `redactSecrets`, `redactEmails`, `coarsenPath`, `applyPrivacy(text, opts)`, `PrivacyHit` counters.
   - Thêm vài pattern secret phổ biến (JWT-ish, private key blocks đã có, Slack/GitHub đã có) — giữ deterministic, không dependency.
   - Email: regex conservative `[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}`.
   - *Alternative:* chỉ mở rộng `sensitive.ts` — vẫn OK nhưng tách `privacy` giúp export/report không import “hook” path.

2. **Path coarsen**
   - `coarsenPath("src/hooks/git/run.ts")` → `src/**/run.ts` (giữ first segment + basename; root file → `(root)/name` hoặc `name`).
   - Depth-1 (`src/foo.ts`) → `src/foo.ts` unchanged (không có middle).

3. **export flags**
   - `--redact-paths`: coarsen paths in exported records.
   - `--privacy-dry-run`: scan candidates, print counts `{ secrets, emails, paths, skippedSensitive }`, exit 0, **do not write** eval file.
   - Always redact secrets/emails in text fields written to export (safe default; not BREAKING vs skip-only — stronger).

4. **Report commands**
   - Shared `--redact-paths` on customer-report, dashboard, digest.
   - Apply when formatting module labels / any path strings; no dry-run on these in MVP (export owns dry-run).

5. **printable()**
   - Keep control-char strip; privacy runs before/after as documented in code (secrets first, then email, then path if opted).

## Risks / Trade-offs

- [False positive email/secret] → Conservative patterns; dry-run để user kiểm.
- [Coarsen làm khó debug] → Opt-in only.
- [Export luôn redact secret đổi hash eval] → Acceptable for share-out; local eval vẫn từ DB gốc khi không export.

## Migration Plan

- Không migration. Rollback: gỡ flags + module privacy wiring.

## Open Questions

Không có.
