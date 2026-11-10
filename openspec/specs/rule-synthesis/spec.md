# rule-synthesis Specification

## Purpose

Tổng hợp lỗi AI đã ghi trong NightOwl thành đề xuất quy ước Markdown local, để người dùng đưa vào file rule dự án mà không gửi dữ liệu đi đâu trừ khi họ bật LLM.

## Requirements

### Requirement: Lệnh suggest-rules đọc failure local
`nightowl suggest-rules` SHALL đọc failure từ store dự án (không tạo DB mới nếu chưa có), áp bộ lọc trạng thái/category/agent/thời gian, và sinh một hoặc nhiều khối đề xuất rule dạng Markdown ra stdout (mặc định).

#### Scenario: Có failure confirmed convention
- **WHEN** store có ≥1 failure `confirmed` category `convention` và chạy `nightowl suggest-rules`
- **THEN** stdout chứa Markdown đề xuất rule liên quan; thoát 0

#### Scenario: Chưa init / không có DB
- **WHEN** chạy lệnh trong repo chưa có `.nightowl/`
- **THEN** stderr hướng dẫn init hoặc báo không có dữ liệu; thoát mã khác 0; không tạo DB

### Requirement: Mặc định không LLM và không ghi file dự án
Không có cờ opt-in LLM, lệnh SHALL chỉ dùng heuristic/template local. Không có cờ ghi file tường minh, lệnh SHALL NOT sửa `CLAUDE.md`, `.cursorrules`, hay file rule khác trong repo.

#### Scenario: Dry output mặc định
- **WHEN** chạy `nightowl suggest-rules` không `--yes` và không `--write`
- **THEN** chỉ in đề xuất; không gọi mạng; không đổi file ngoài (có thể) đường dẫn output tạm nếu có `--output`

### Requirement: Bộ lọc và ưu tiên category lặp
Lệnh SHALL hỗ trợ lọc `--since`, `--category` (lặp), `--agent` (lặp), và trạng thái (mặc định ưu tiên `confirmed`). Khi không chỉ định category, SHALL ưu tiên hoặc mặc định gồm `convention` và `missing-context` (có thể mở rộng các category khác bằng flag).

#### Scenario: Lọc category
- **WHEN** `nightowl suggest-rules --category convention`
- **THEN** đề xuất chỉ dựa trên failure `convention` (sau các filter khác)

### Requirement: LLM opt-in để diễn đạt rule
The command SHALL NOT call an LLM unless the user opts in (for example `--yes` with a classify-like transport). When opted in, the command SHALL call the selected local/API model only to rephrase rules from the already-selected failure clusters.

#### Scenario: Không --yes thì không gọi model
- **WHEN** chạy không opt-in LLM
- **THEN** không spawn `claude` và không gọi Anthropic API

### Requirement: Ghi file chỉ khi chỉ định rõ
Chỉ khi có tuỳ chọn ghi tường minh (ví dụ `--write <path>`), lệnh SHALL ghi (hoặc nối) Markdown đề xuất vào đường dẫn đó theo chế độ đã document (create/append/replace). SHALL từ chối ghi đè file không phải rule NightOwl đã biết trừ khi `--force`.

#### Scenario: Write path
- **WHEN** `nightowl suggest-rules --write .nightowl/suggested-rules.md`
- **THEN** file được tạo/ cập nhật với nội dung đề xuất; stdout có thể xác nhận đường dẫn

### Requirement: Không lộ secret trong đề xuất
Nội dung rule xuất ra SHALL NOT chứa secret inline đã lọc (cùng chính sách snapshot/export). Diff/code mẫu trong đề xuất SHALL bị cắt hoặc bỏ qua nếu chứa secret.

#### Scenario: Failure chứa secret
- **WHEN** failure được chọn có nội dung khớp bộ lọc secret
- **THEN** đề xuất không chứa chuỗi secret đó
