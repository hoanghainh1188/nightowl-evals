# Spec Delta

## ADDED Requirements

### Requirement: Filter workspace áp dụng cho check có path
API/filter workspace đã dùng cho failure path SHALL tái sử dụng được cho hàng check (hoặc edit gắn check) có `file_path` relative trong repo. Hàng không có path SHALL NOT bị coi là thuộc workspace khi filter active (bị loại khỏi tập scoped).

#### Scenario: Check path trong package được giữ
- **WHEN** filter workspace `packages/ui` và check/edit có `file_path` `packages/ui/src/a.ts`
- **THEN** hàng đó nằm trong tập sau filter

#### Scenario: Check không path bị loại khỏi scoped set
- **WHEN** filter workspace active và hàng check không có `file_path`
- **THEN** hàng đó không thuộc tập scoped dùng cho `changedRate` workspace
