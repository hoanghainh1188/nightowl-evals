# Proposal

## Why

Team nội bộ nhanh chóng bị ngập danh sách failure gần trùng; `suggest-rules` đã gom thô theo category+module+agent nhưng `report` / review / dashboard chưa chia sẻ cùng mô hình cluster, nên khó triage và đề xuất rule theo **nhóm** (roadmap #35).

## What Changes

- Thêm capability **failure clustering** local, deterministic: gom failure theo category + module (+ agent khi có) và **fingerprint diff** ổn định (không LLM, không mạng).
- Tách / tái dùng logic cluster dùng chung (nâng cấp `suggest-rules` từ chỉ category+module+agent sang cùng fingerprint khi có đủ nội dung).
- `nightowl report` (text + `--json`) và `nightowl dashboard` hiển thị top cluster (count, key, sample paths) — không lộ tên developer; fingerprint/opaque id không chứa secret plaintext.
- `nightowl review` hỗ trợ xem/lọc theo cluster (ít nhất list có cluster key và lọc theo key đã document).
- Cập nhật README; tick #35 trên `docs/v0.5-roadmap-ideas.md` khi archive.
- **Không** revert signals (#33), không digest (#36), không SaaS/sync, không clustering embedding/LLM.

## Capabilities

### New Capabilities

- `failure-clustering`: Gom nhóm failure AI local theo category/module/fingerprint deterministic; cung cấp key/cluster list cho report, review, rules.

### Modified Capabilities

- `rule-synthesis`: `suggest-rules` dùng cùng định nghĩa cluster (fingerprint) thay vì chỉ category+module+agent khi áp dụng được.
- `failure-report`: Báo cáo top / by-cluster trong cửa sổ lọc.
- `failure-review`: List/filter theo cluster key.
- `local-dashboard`: Section top clusters trên HTML local.

## Impact

- Code: module cluster/fingerprint dùng chung (`src/cluster/` hoặc nâng `src/rules/cluster.ts`), report/dashboard formatters, review list queries, suggest-rules; tests Vitest.
- Schema: ưu tiên **tính on-read** (không bắt buộc migration); nếu cache cột `cluster_key` thì migration idempotent qua openStore/`init`.
- Không đổi hook fail-open / postcommit deadline.
- Out of scope: SaaS dashboard, multi-repo sync, email/Slack auto-send, LLM clustering, lưu plaintext secret trong fingerprint/log.
