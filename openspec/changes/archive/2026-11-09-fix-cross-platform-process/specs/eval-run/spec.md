# Spec Delta

## MODIFIED Requirements

### Requirement: Lời gọi model tách biệt và an toàn
Mỗi lời gọi SHALL dùng Claude Code CLI ở chế độ không tương tác, không có tool nào (kể cả MCP và skill trong cấu hình người dùng), không lưu phiên, đầu ra JSON theo schema, với `NIGHTOWL_INTERNAL=1`, trong thư mục tạm rỗng, và bị huỷ (cả nhóm tiến trình) sau 180 giây trên cả POSIX và Windows. Đầu ra không hợp lệ, nội dung quá 512 KB, đầu ra thô quá 4 MB (tiến trình bị huỷ ngay), hoặc lời gọi lỗi SHALL được ghi là thất bại cho bài đó với model đó, và lệnh SHALL chạy tiếp các bài còn lại rồi thoát mã 1.

#### Scenario: Lời gọi treo
- **WHEN** `claude` không trả lời trong 180 giây cho một bài
- **THEN** tiến trình bị huỷ, bài đó được ghi là thất bại cho model đó, các bài khác vẫn chạy, mã thoát 1

#### Scenario: Huỷ tiến trình trên Windows
- **WHEN** lời gọi model bị huỷ trên Windows
- **THEN** toàn bộ cây tiến trình bị huỷ an toàn theo cơ chế của Windows
