# Spec Delta

## ADDED Requirements

### Requirement: Dashboard hiển thị metric repeat
`nightowl dashboard` SHALL đưa metric repeat (theo `repeat-outcomes`, cùng filter since/agent/workspace như report khi áp dụng) vào HTML tĩnh: ít nhất tóm tắt repeat_count / new_count / rate (hoặc “n/a” khi rate null). SHALL NOT thêm request mạng hay tên developer.

#### Scenario: HTML có khối repeat
- **WHEN** chạy `nightowl dashboard` trên store có key trong window
- **THEN** file HTML chứa số liệu hoặc nhãn repeat/new đã document

#### Scenario: Rate null hiện n/a
- **WHEN** window không có key đủ điều kiện (repeat_rate null)
- **THEN** dashboard không hiện 0% giả — dùng n/a hoặc tương đương đã document
