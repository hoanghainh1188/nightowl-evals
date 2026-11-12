# Spec Delta

## ADDED Requirements

### Requirement: Module path chuẩn hóa separator
Trước khi tính nhãn module theo `--depth` hoặc workspace, `nightowl report` (và mọi caller dùng cùng quy tắc module đã document) SHALL chuẩn hóa separator đường dẫn relative trong repo: `\` và `/` tương đương. Kết quả nhãn module SHALL dùng `/` (hoặc nhãn workspace) và SHALL NOT phụ thuộc OS separator của path đầu vào.

#### Scenario: Path kiểu Windows vẫn ra cùng module
- **WHEN** failure có `file_path` dạng `src\\hooks\\a.ts` (hoặc tương đương) và depth 2, không thuộc workspace package
- **THEN** nhãn module bằng `src/hooks` (cùng kết quả như `src/hooks/a.ts`)
