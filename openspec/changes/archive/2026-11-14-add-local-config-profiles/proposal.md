# Proposal

## Why

Team 2–3 máy lặp lại cùng bộ flag (`--fail-on-rate`, privacy, prune profile, agents, workspace, cửa sổ digest) qua README/CI copy-paste — dễ lệch giữa máy và khó onboard. Cần **profile config local đã document**, chia sẻ được qua git (không secret) và lớp máy-local gitignore, vẫn 100% offline.

## What Changes

- Thêm **project config** commit được ở root repo (JSON đã document) chứa defaults an toàn (không API key / token / path tuyệt đối máy khác).
- Thêm **local overlay** dưới `.nightowl/` (đã gitignore) để override theo máy khi cần.
- CLI đọc config khi **flag tương ứng không truyền**; flag CLI luôn thắng. Áp dụng tối thiểu cho: report CI gate / agents / workspace, digest window, prune profile, privacy path-redaction mặc định (export/share khi có cờ tương đương).
- `nightowl doctor` kiểm tra config tồn tại/hợp lệ (schema, giá trị lạ → lỗi rõ, không crash).
- Document mẫu file + README/`--help`; tuỳ chọn `init` ghi mẫu project config nếu chưa có (không ghi đè).
- **Không BREAKING** hành vi hiện tại khi không có file config (built-in defaults như nay).
- **Out of scope:** sync remote / cloud profile, telemetry, SaaS team settings, LLM keys trong config, GitHub Action bắt buộc đọc config (có thể follow-up), TOML/YAML song song ở v1, dashboard team hosted.

## Capabilities

### New Capabilities

- `local-config`: Định vị, đọc, merge (project + local overlay), validate schema/giá trị, và cung cấp defaults cho lệnh khi flag CLI vắng mặt — local-only, không mạng.

### Modified Capabilities

- `cli`: Help/`--help` nêu file config, precedence flag > config, và lệnh liên quan.
- `project-setup`: `doctor` kiểm tra config; `init` có thể tạo mẫu project config an toàn khi chưa có.
- `failure-report`: `report` áp dụng defaults từ config khi thiếu flag (fail-on-rate, agent, workspace, … đã document).
- `weekly-digest`: `digest` áp dụng cửa sổ/agent/workspace mặc định từ config khi thiếu flag.
- `local-storage`: `prune` áp dụng retention profile mặc định từ config khi thiếu `--profile`/`--days`.
- `export-privacy`: Export/share tôn trọng default redact-paths (hoặc tương đương) từ config khi flag không truyền.
- `shell-completion`: Completion gợi ý đường dẫn/file config nếu có flag liên quan (hoặc document-only nếu không thêm flag).

## Impact

- Code: module mới kiểu `src/config/*` (load/merge/validate), wiring trong `report` / `digest` / `prune` / `export` / `share-pack` / `doctor` / có thể `init`, README, completion catalog.
- Tests: unit parse/merge/precedence + CLI doctor + ít nhất một lệnh surface mỗi nhóm defaults.
- Dependencies: không thêm runtime dependency (JSON + `node:fs` / `node:path`).
- Hard-rule: không exception (local-only, không telemetry, không chấm người, không secret trong mẫu commit).
