# Spec Delta

## ADDED Requirements

### Requirement: Report gồm metric repeat
`nightowl report` SHALL tính metric repeat theo capability `repeat-outcomes` trên cùng cửa sổ `--since` / agent / workspace (khi có) như failures được báo cáo, và SHALL in tóm tắt repeat trên bản text. Bản `--json` SHALL có object `repeat` với các khoá đã document (ít nhất `repeat_count`, `new_count`, `repeat_rate`, và mốc baseline/window khi áp dụng). Field hiện có (`total`, `noise`, `clusters`, `changed_rate`, …) SHALL giữ semantics. Lệnh vẫn chỉ đọc store.

#### Scenario: JSON có object repeat
- **WHEN** chạy `nightowl report --json` trên store có failure đủ fingerprint trong window và baseline
- **THEN** stdout JSON có `repeat` với `repeat_count`, `new_count`, và `repeat_rate` (số hoặc null)

#### Scenario: Text nêu repeat
- **WHEN** chạy `nightowl report` (text) khi có ít nhất một key trong window
- **THEN** stdout có dòng/section tóm tắt repeat vs new (hoặc rate) theo ngôn ngữ đã document

#### Scenario: Không đổi changed_rate
- **WHEN** so sánh `changed_rate` trước/sau change trên cùng fixture
- **THEN** công thức và giá trị `changed_rate` không đổi chỉ vì thêm metric repeat
