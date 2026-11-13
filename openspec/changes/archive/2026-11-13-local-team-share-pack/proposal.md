# Proposal

## Why

Team cần gửi báo cáo AI quality cho nhau **offline** (email/Drive/USB) mà không mở SaaS và không lộ path/PII thừa. Hiện đã có `report` / `digest` / `customer-report` + `--redact-paths`, nhưng phải chạy nhiều lệnh và tự ghép file — dễ quên redaction hoặc thiếu manifest privacy.

## What Changes

- Thêm lệnh local `nightowl share-pack` (tên final trong design) tạo **gói share-out** trên đĩa: ít nhất report (text/md hoặc json đã document) + digest + **manifest privacy** (profile/flags đã áp dụng, generatedAt, nightowl version nếu biết).
- Mặc định bật redaction path (hoặc tương đương share-safe); SHALL NOT gồm tên/email developer; SHALL NOT gọi mạng / upload.
- Output: thư mục pack dưới `.nightowl/` (hoặc `-o`); tuỳ chọn archive nén local (tar.gz qua Node built-ins — **không** thêm dependency zip nếu tránh được).
- Cập nhật `--help`, README, completion.
- **Không** SaaS share link, không email SMTP, không đính raw SQLite / export JSONL đầy đủ code trừ khi design chọn opt-in rõ (mặc định **không**).

## Capabilities

### New Capabilities

- `local-team-share`: gói share-out local (bundle + privacy defaults) cho team offline

### Modified Capabilities

- `cli`: đăng ký lệnh share-pack + help
- `shell-completion`: flag/subcommand mới
- `export-privacy`: (nếu cần) yêu cầu pack dùng cùng profile redaction / coarsen path

## Impact

- Lệnh mới + module pack nhỏ tái sử dụng `buildReport` / digest / `redactPathsInReport`.
- Tests command + pack contents. macOS/Linux/Windows path/output.
- Docs README. Open-core only; no network.
