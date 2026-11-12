# Design

## Context

See `proposal.md` — Why. Hiện `src/rules/cluster.ts` gom theo `category + module + agent` cho `suggest-rules` only. `report` / `dashboard` / `review` chưa có cluster. Secret filtering đã có trên export/snapshot paths — fingerprint phải đi qua cùng (hoặc tương đương) redact trước khi hash.

## Goals / Non-Goals

**Goals:**
- Module fingerprint + cluster key thuần hàm, deterministic cross-OS.
- Một nguồn sự thật dùng chung cho suggest-rules, report, review, dashboard.
- Tính on-read mặc định (không bắt buộc schema mới) để ship nhanh và an toàn.

**Non-Goals:**
- Embedding / LLM / network clustering.
- Revert signals (#33), weekly digest (#36), rewrite toàn bộ TUI.
- Cache `cluster_key` trên SQLite trừ khi đo được bottleneck rõ (để follow-up).

## Decisions

1. **Fingerprint = SHA-256 (hex rút gọn) của normalized diff tokens**
   - Normalize: strip whitespace-only lines noise nhẹ, áp secret redact hiện có trên snippet so sánh, rồi hash `ai→final` delta (hoặc cặp nội dung đã chuẩn hoá).
   - *Rationale:* Opaque, ổn định, không lộ plaintext trong key.
   - *Alternative:* SimHash / LSH — phức tạp hơn, khó giải thích.

2. **Cluster key = `category|module|agent|fingerprint` (separator đã document, không NUL trong wire JSON)**
   - Agent null → token trống hoặc `unknown` thống nhất với report.
   - *Rationale:* Mở rộng key hiện tại của rules; fingerprint tách “cùng module nhưng khác lỗi”.

3. **Shared module `src/cluster/` (hoặc refactor `rules/cluster.ts` gọi shared)**
   - `fingerprintFailure(ai, final, filePath)`, `clusterKey(...)`, `groupFailures(...)`.
   - suggest-rules chuyển sang shared API; giữ `--min-count` / `--limit` / depth.

4. **Surfaces**
   - `buildReport` thêm `clusters: { key, category, module, agent, count, samplePaths }[]` top N.
   - `formatText` / `formatJson` / dashboard HTML section.
   - `review` list JSON field + `--cluster <key>` filter (exact match).

5. **minCount mặc định 2** cho report/dashboard; review filter không cần minCount (show membership).

## Risks / Trade-offs

- [Over-split clusters] → Mitigation: fingerprint trên normalized content; document rằng format-only khác logic sẽ khác group (noise-filtering đã tách).
- [Secret in paths] → Mitigation: sample paths relative như report; fingerprint không gồm absolute home paths.
- [Perf large DB] → Mitigation: on-read group in memory trên failure rows đã filter by since; follow-up index/cache nếu cần.

## Migration Plan

- Không migration MVP.
- Rollback: gỡ surfaces/CLI flags; logic cluster thuần code.

## Open Questions

Không có (TUI chỉ inherit `--cluster` nếu dễ; không block ship list CLI).
