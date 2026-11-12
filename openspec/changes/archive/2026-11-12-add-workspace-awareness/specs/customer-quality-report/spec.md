# Spec Delta

## ADDED Requirements

### Requirement: Customer-report tôn trọng workspace
`nightowl customer-report` SHALL dùng cùng quy tắc gắn module/workspace như `report` khi có discovery, và SHALL chấp nhận `--workspace` với semantics lọc tương đương. SHALL NOT lộ tên/email developer.

#### Scenario: Filter workspace trên customer-report
- **WHEN** chạy customer-report với `--workspace` khớp một package và dữ liệu đa package
- **THEN** output module/metrics chỉ gồm workspace đó; mã thoát 0 khi cấu hình hợp lệ
