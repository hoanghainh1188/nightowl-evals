# Proposal

## Why

README đã có ví dụ CI thủ công (`npm install -g` + `nightowl report --fail-on-rate`), nhưng mỗi repo phải copy-paste nhiều bước và không có sticky comment trên PR. Đóng gói composite GitHub Action giúp team bật quality gate + báo cáo “AI Coding Health” trên PR trong một bước `uses:`, đúng ý tưởng roadmap #22.

## What Changes

- Thêm composite GitHub Action trong repo (ví dụ `action/` hoặc path cố định): cài NightOwl, chạy `nightowl report` với `--json` / `--output` / `--fail-on-rate`, và (tuỳ chọn) đăng sticky comment tóm tắt lên Pull Request.
- Inputs rõ ràng: ngưỡng `fail-on-rate`, `since`, đường dẫn báo cáo, bật/tắt comment PR, phiên bản package npm.
- Tài liệu README: thay/ bổ sung mục CI bằng ví dụ `uses:` một dòng + lưu ý database `.nightowl/` (gitignored) phải có sẵn trên runner (cache/artifact/self-hosted) trước khi chạy gate.
- Binary `nightowl` vẫn **không** gọi mạng; chỉ Action (khi bật comment) dùng GitHub API với `GITHUB_TOKEN` do workflow cấp — không telemetry NightOwl.

## Capabilities

### New Capabilities

- `github-action`: composite Action đóng gói CI quality gate (`report` + fail-on-rate) và sticky PR comment từ JSON báo cáo

### Modified Capabilities

- (không đổi requirement CLI/`failure-report` — tái dùng hành vi `report` đã có)

## Impact

- Thêm `action.yml` (+ script helper nếu cần format comment) dưới thư mục Action trong repo.
- README: mục CI/CD Quality Gate.
- Quyền workflow mẫu: `pull-requests: write` khi bật comment; `contents: read` tối thiểu.
- Không đổi schema SQLite, hooks, hay CLI trừ khi cần cờ hỗ trợ Action (không kỳ vọng).
