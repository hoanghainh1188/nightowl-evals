# Tasks

## 1. Detect + ingest core

- [x] 1.1 Unit tests: parse message `This reverts commit <sha>`; bỏ message không khớp; dedupe_key ổn định
- [x] 1.2 Module scan git log + khớp `failures.commit_sha`; ghi event `source=git` `kind=revert` idempotent
- [x] 1.3 Lệnh `nightowl ingest-revert` (`--since`, help nêu giới hạn); verify chưa init / không phải git repo

## 2. Report + dashboard surfaces

- [x] 2.1 Tests: `report` text/`--json` có signals.revert; dashboard HTML có nhãn revert
- [x] 2.2 Mở rộng `SIGNAL_KINDS` / `ReportSignals` / formatters report + dashboard + customer-report nếu dùng chung
- [x] 2.3 README mô tả `ingest-revert` + giới hạn; completion catalog nếu có

## 3. CLI wiring + validate

- [x] 3.1 Đăng ký lệnh trong `commands/index` + help cấp cao; test help chứa tên lệnh
- [x] 3.2 Integration test: fake git repo + failure commit_sha → ingest → count revert = 1; chạy lần 2 không tăng
- [x] 3.3 `npm test` + typecheck + `openspec validate add-revert-failure-signals` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick ideation #33 Done trong `docs/v0.5-roadmap-ideas.md`.
