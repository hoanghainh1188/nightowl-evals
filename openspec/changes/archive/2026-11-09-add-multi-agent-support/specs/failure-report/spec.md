## ADDED Requirements

### Requirement: Báo cáo theo agent
`nightowl report` SHALL in nhóm lỗi theo `agent` (không tính `dismissed`). Bản `--json` SHALL có `by_agent` map agent → số lỗi (kể cả 0 cho agent đã thấy trong cửa sổ nếu design chọn đủ khoá; tối thiểu mọi agent có count > 0).

#### Scenario: Hai agent
- **WHEN** có 3 failure `cursor` và 1 `claude-code` (không dismissed)
- **THEN** báo cáo liệt kê cả hai agent với đúng số đếm

### Requirement: Chỉ số đối đầu theo agent
`nightowl report` SHALL thêm chỉ số đối đầu trong cửa sổ `--since`: với mỗi agent, tỷ lệ hoặc tỷ số “AI edits bị dev sửa / edits đã kiểm tra tại commit” (cùng ý với % hiện có, nhưng tách theo agent). Bản `--json` SHALL có cấu trúc tương ứng (ví dụ `head_to_head`).

#### Scenario: Cursor xấu hơn Claude
- **WHEN** trong tuần, Claude Code 10% edits đổi và Cursor 25% edits đổi
- **THEN** stdout/JSON phản ánh hai tỷ lệ tách biệt theo agent

### Requirement: Lọc theo agent
`nightowl report` SHALL chấp nhận `--agent <id>` (lặp được) để chỉ tính failure/metric của agent đó.

#### Scenario: Lọc cursor
- **WHEN** `nightowl report --agent cursor`
- **THEN** không tính failure `claude-code` vào tổng và các nhóm
