# Spec Delta

## ADDED Requirements

### Requirement: Dashboard tôn trọng workspace
HTML `nightowl dashboard` SHALL dùng cùng quy tắc module/workspace như `report` khi có discovery, và SHALL chấp nhận `--workspace`. SHALL NOT lộ tên/email developer.

#### Scenario: Filter workspace trên dashboard
- **WHEN** chạy dashboard với `--workspace` hợp lệ trên monorepo fixture
- **THEN** HTML module section chỉ phản ánh workspace đó; mã thoát 0
