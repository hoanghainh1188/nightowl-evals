# Spec Delta

## ADDED Requirements

### Requirement: Module tôn trọng workspace khi có
Khi discovery tìm thấy ≥1 workspace/package root, nhãn module trong `nightowl report` (text và `--json`) SHALL dùng nhãn workspace đã document cho file thuộc package đó (ví dụ path root hoặc package `name`). File ngoài mọi package SHALL vẫn dùng quy tắc `--depth` hiện có. Khi không có workspace, semantics `--depth` SHALL không đổi.

#### Scenario: Monorepo package label
- **WHEN** failure ở `packages/ui/src/a.ts`, workspace `packages/ui` được phát hiện, chạy `nightowl report`
- **THEN** `byModule` (hoặc tương đương) có nhãn workspace đã document cho failure đó, không chỉ `packages/ui` cắt depth nông sai nghĩa nếu design chọn name/`packages/ui` ổn định

### Requirement: Lọc --workspace trên report
`nightowl report` SHALL chấp nhận `--workspace <name>` (repeatable nếu design chọn). Khi có, chỉ failure (và metrics liên quan trong cửa sổ) thuộc workspace khớp SHALL được tính. Tên không hợp lệ/không khớp SHALL lỗi rõ hoặc cho kết quả rỗng theo design đã document; thoát ≠ 0 nếu chọn lỗi.

#### Scenario: Filter workspace
- **WHEN** chạy `nightowl report --workspace packages/ui` (hoặc name đã document) với failure trong và ngoài package
- **THEN** tổng/module chỉ phản ánh failure trong workspace đó
