# Spec Delta

## ADDED Requirements

### Requirement: Default redactPaths từ local config
Khi config đặt `redactPaths` (boolean đã document) và người dùng **không** truyền cờ redact/`--no-redact-paths` tương ứng, các lệnh export / share-pack / dashboard / digest (khi có cờ path redaction) SHALL dùng giá trị config làm mặc định hiệu dụng. Flag CLI tường minh SHALL thắng. Thiếu khoá → giữ default lệnh hiện tại (share-pack mặc định coarsen; dashboard/digest/export opt-in như đã document).

#### Scenario: Config bật redact cho dashboard
- **WHEN** config `redactPaths: true` và chạy `dashboard` không `--redact-paths` trên report có path sâu
- **THEN** HTML coarsen path như khi có `--redact-paths`

#### Scenario: --no-redact-paths thắng config trên share-pack
- **WHEN** config `redactPaths: true` và chạy `share-pack --no-redact-paths`
- **THEN** path trong gói không bị coarsen vì flag CLI
