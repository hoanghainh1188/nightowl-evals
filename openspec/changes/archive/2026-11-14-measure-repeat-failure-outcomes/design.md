# Design

## Context

Clustering on-read đã có (`fingerprintFailure` + `clusterKey` / `groupFailures`); `report`/`dashboard` truyền `clusters` vào `buildReport`. Digest gọi `buildReport` **không** load clustering. Không có metric so hai cửa sổ. Constraint: local-only, Node built-ins, không đổi `changedRate`, macOS/Linux/Windows. Xem proposal.md — Why.

## Goals / Non-Goals

**Goals:**
- Module thuần tính `RepeatOutcomes` từ hai tập failure (baseline + window) qua cùng `clusterKeyForFailure`.
- Surface `repeat` trên report JSON/text, digest, dashboard; flag `--baseline-since` trên report (và digest nếu cùng parser since).
- Baseline mặc định = cửa sổ liền trước cùng độ dài khi chỉ có `--since`.

**Non-Goals:**
- Bảng SQL mới / migration schema.
- Gắn `is_repeat` bắt buộc trên từng cluster JSON (có thể phase sau).
- Đổi share-pack clustering (giữ `clusters: []` trừ khi follow-up).
- LLM, telemetry, SaaS.

## Decisions

1. **Đếm theo key, không theo failure count**  
   Repeat/new = cardinality của set key. Một cluster 10 failure vẫn 1 key.  
   *Alt:* đếm failure — bỏ vì roadmap “tỷ lệ lỗi lặp” gắn pattern, không volume một bug.

2. **Reuse `clusterKeyForFailure` + depth/workspace giống report**  
   Cùng `DEFAULT_DEPTH` / `--depth` / workspace filter với failures đang report.  
   *Alt:* chỉ fingerprint — bỏ vì lệch module/agent với cluster UI.

3. **On-read, không persist**  
   Query `listFailuresForClustering` (hoặc tương đương) cho `[baseline, since)` và `[since, ∞)` / window end=now.  
   *Alt:* materialize table — overkill cho v1.

4. **JSON shape** (snake_case, additive):
   ```json
   "repeat": {
     "repeat_count": 2,
     "new_count": 3,
     "repeat_rate": 0.4,
     "baseline_since": "...",
     "window_since": "..."
   }
   ```
   `repeat_rate` null khi denominator 0. Pass-through qua `buildReport` như `noise`/`signals`.

5. **Baseline mặc định**  
   Nếu `since` có và không có `--baseline-since`: `baseline_since = since - (now - since)` (cùng duration). Nếu không `since`: `repeat_rate` null, counts 0 hoặc chỉ new=keys(window) với baseline rỗng — **chốt:** không `since` → baseline empty → mọi key trong full history là **new**, rate = 0 nếu có key (không “lặp” vì không có trước). Document rõ.  
   *Alt:* ẩn block repeat khi không since — kém discoverability.

6. **Digest wiring**  
   Digest load failures cho clustering (hoặc gọi helper shared) trong cửa sổ digest; baseline mặc định cùng quy tắc. Không bắt buộc `--baseline-since` trên digest v1 nếu cost cao — vẫn tính default.

7. **Flag**  
   `--baseline-since <YYYY-MM-DD>` trên `report` (và completion catalog). Validate như `--since`.

## Risks / Trade-offs

- **[Cost]** Hai query clustering trên DB lớn → Mitigation: tái dùng indexes v9; cùng path listFailures; optional sau gắn `--debug-timing`.  
- **[Fingerprint thiếu]** Failure không có content → không key → không đếm → Mitigation: document; không silent-fill.  
- **[rules/cluster vs report cluster]** `moduleOf` vs `moduleLabel` → Mitigation: metric đi theo **report** path (workspace-aware).  
- **[Semver cảm nhận]** JSON thêm field — additive, không BREAKING.

## Migration Plan

- Không migration DB. Deploy: ship CLI; user cũ thấy field mới trên report. Rollback: revert package.

## Open Questions

- (Không blocking) Có nên thêm `is_repeat` optional trên `clusters[]` trong cùng change hay follow-up — mặc định **không** trong tasks Core; chỉ summary object.
