# Spec Delta

## ADDED Requirements

### Requirement: prune đọc profile từ local config
Khi không truyền `--profile` và không truyền `--days`, `nightowl prune` SHALL dùng retention profile từ local-config nếu có và hợp lệ; nếu không có trong config, dùng default prune hiện tại. `--days` hoặc `--profile` trên CLI SHALL thắng config. Config invalid SHALL thoát ≠ 0 trước khi xoá dữ liệu.

#### Scenario: Profile từ config
- **WHEN** config đặt prune profile `short` (hoặc giá trị hợp lệ đã document) và chạy `prune --dry-run` không `--profile`/`--days`
- **THEN** dry-run dùng ngưỡng ngày tương ứng profile đó

#### Scenario: --days thắng config
- **WHEN** config đặt profile và người dùng truyền `--days 90`
- **THEN** prune dùng 90 ngày (có thể cảnh báo override như hiện tại nếu cũng có `--profile`)
