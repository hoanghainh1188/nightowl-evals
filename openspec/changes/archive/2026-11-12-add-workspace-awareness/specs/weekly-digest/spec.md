# Spec Delta

## ADDED Requirements

### Requirement: Digest chấp nhận --workspace
`nightowl digest` SHALL chấp nhận `--workspace` với semantics lọc path/workspace giống report khi digest đếm failure theo cửa sổ. Nếu một phần digest không gắn module, filter vẫn SHALL loại failure ngoài workspace trước khi aggregate. Cờ không hợp lệ SHALL lỗi rõ.

#### Scenario: Digest lọc workspace
- **WHEN** chạy `nightowl digest --workspace <name>` với store monorepo có failure đa package
- **THEN** tổng failure trong digest chỉ gồm workspace khớp; mã thoát 0
