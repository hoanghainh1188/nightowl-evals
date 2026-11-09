# Spec Delta

## MODIFIED Requirements

### Requirement: Lời gọi LLM tách biệt
Mỗi lời gọi SHALL chạy Claude Code CLI ở chế độ không tương tác, không có tool nào (kể cả tool của MCP server và skill trong cấu hình của người dùng), không lưu phiên, đầu ra JSON theo schema, với biến môi trường `NIGHTOWL_INTERNAL=1`, và bị huỷ cả nhóm tiến trình nếu quá 120 giây hoặc khi đầu ra vượt ngưỡng an toàn trên cả POSIX và Windows.

#### Scenario: Lời gọi treo
- **WHEN** `claude` không trả kết quả sau 120 giây
- **THEN** tiến trình bị huỷ, bản ghi giữ nguyên chưa phân loại, các bản ghi còn lại vẫn được xử lý

#### Scenario: Huỷ tiến trình trên Windows
- **WHEN** lời gọi `claude` bị huỷ trên Windows do quá thời gian hoặc vượt dung lượng
- **THEN** toàn bộ cây tiến trình bị huỷ bằng cơ chế phù hợp với Windows mà không ném lỗi tín hiệu POSIX
