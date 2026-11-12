# Spec Delta

## ADDED Requirements

### Requirement: Gợi ý bước tiếp sau khi ghi đề xuất rule
Khi `nightowl suggest-rules` ghi file thành công qua `--write` hoặc `--output`, lệnh SHALL in trên stderr (không phải bắt buộc trên stdout Markdown) các gợi ý bước tiếp local đã document: đánh dấu rule đã áp dụng bằng `rule-impact mark --label <id>` (người dùng chọn label), rồi xem impact / digest / dashboard. Lệnh SHALL NOT tự chạy mark, SHALL NOT gọi mạng/LLM chỉ vì gợi ý, và SHALL NOT sửa thêm file ngoài đích `--write`/`--output` đã chọn.

#### Scenario: Sau --write có next-step hints
- **WHEN** chạy `nightowl suggest-rules --write CLAUDE.md` thành công trên store hợp lệ
- **THEN** stderr chứa gợi ý `rule-impact mark` (và nhắc xem impact hoặc digest/dashboard); thoát 0; không tạo bản rule-applied mới chỉ vì lần chạy này

#### Scenario: Sau --output có next-step hints
- **WHEN** chạy `nightowl suggest-rules --output .nightowl/suggested-rules.md` thành công
- **THEN** stderr chứa gợi ý bước tiếp mark/impact tương tự `--write`; thoát 0

#### Scenario: Chỉ stdout không gợi ý ghi
- **WHEN** chạy `nightowl suggest-rules` không `--write` và không `--output`
- **THEN** không yêu cầu stderr phải có chuỗi gợi ý mark; không ghi file
