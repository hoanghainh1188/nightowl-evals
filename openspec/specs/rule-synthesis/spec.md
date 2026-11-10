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
Không có cờ opt-in LLM, lệnh SHALL chỉ dùng heuristic/template local. Không có `--output` và không có `--write`, lệnh SHALL NOT tạo/sửa file trên đĩa (chỉ stdout) và SHALL NOT sửa `CLAUDE.md`, `.cursorrules`, hay file rule khác trong repo.

#### Scenario: Dry output mặc định
- **WHEN** chạy `nightowl suggest-rules` không `--yes`, không `--output`, và không `--write`
- **THEN** chỉ in đề xuất ra stdout; không gọi mạng; không đổi file nào trên đĩa

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
Lệnh SHALL hỗ trợ đúng một trong hai chế độ ghi tường minh: `--output <path>` (file đề xuất NightOwl độc lập) hoặc `--write <path>` (khối marker trong file rule dự án). Không có cả hai cờ thì SHALL NOT ghi file. Symlink đích SHALL bị từ chối.

#### Scenario: Write path
- **WHEN** `nightowl suggest-rules --write .nightowl/suggested-rules.md`
- **THEN** file được tạo/ cập nhật với nội dung đề xuất trong khối marker NightOwl; stdout hoặc stderr có thể xác nhận đường dẫn

#### Scenario: --output file đề xuất độc lập
- **WHEN** `nightowl suggest-rules --output .nightowl/suggested-rules.md`
- **THEN** file được tạo/cập nhật với toàn bộ Markdown đề xuất + marker NightOwl; không sửa `CLAUDE.md`

#### Scenario: --write inject vào file rule dự án
- **WHEN** `CLAUDE.md` đã có nội dung người dùng và chạy `nightowl suggest-rules --write CLAUDE.md`
- **THEN** file vẫn giữ nguyên phần ngoài khối NightOwl; khối marker chứa đề xuất mới; thoát 0

#### Scenario: --write cập nhật idempotent
- **WHEN** chạy `--write CLAUDE.md` lần hai sau khi đã có khối marker
- **THEN** chỉ một khối NightOwl còn lại; nội dung ngoài khối không đổi

#### Scenario: --write thêm khối khi chưa có marker
- **WHEN** file rule chưa có marker NightOwl và chạy `--write` tới path đó
- **THEN** khối marker được thêm (thường cuối file); phần nội dung sẵn có giữ nguyên

#### Scenario: --write marker lệch
- **WHEN** file có marker NightOwl không khớp và chạy `--write` không `--force`
- **THEN** không ghi; stderr nêu rõ; thoát ≠ 0

#### Scenario: Từ chối --output đè file lạ
- **WHEN** `--output` trỏ tới file đã tồn tại không phải đề xuất NightOwl và không có `--force`
- **THEN** không ghi; stderr nêu rõ; thoát ≠ 0

### Requirement: Marker bắt đầu và kết thúc cho khối --write
Khối do `--write` quản lý SHALL dùng cặp marker HTML comment (hoặc tương đương đã document) đánh dấu bắt đầu và kết thúc, đủ để thay thế vùng mà không phụ thuộc phần còn lại của file. Định dạng marker SHALL ổn định và được document trong help/README.

#### Scenario: Khối có start và end
- **WHEN** sau `--write` thành công mở file đích
- **THEN** nội dung chứa đúng một cặp marker bắt đầu/kết thúc NightOwl bao quanh đề xuất

### Requirement: Không lộ secret trong đề xuất
Nội dung rule xuất ra SHALL NOT chứa secret inline đã lọc (cùng chính sách snapshot/export). Diff/code mẫu trong đề xuất SHALL bị cắt hoặc bỏ qua nếu chứa secret.

#### Scenario: Failure chứa secret
- **WHEN** failure được chọn có nội dung khớp bộ lọc secret
- **THEN** đề xuất không chứa chuỗi secret đó
