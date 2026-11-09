# Spec Delta: failure-review

## MODIFIED Requirements

### Requirement: Liệt kê lỗi để xem lại
`nightowl review` (hoặc `nightowl review list`) SHALL in mỗi lỗi một dòng, mới nhất trước, gồm id, ngày, nguồn, loại lỗi, file, số dòng thêm và bỏ, và đầu prompt. Mặc định chỉ lỗi `flagged` và tối đa 20 lỗi. Tuỳ chọn `--status`, `--source` và `--limit` (1–200) thay đổi phần được liệt kê. Với cờ `--json`, stdout SHALL là một mảng JSON chứa các đối tượng bản ghi lỗi với các thuộc tính (`id`, `file_path`, `category`, `source`, `status`, `confidence`, `summary`, `created_at`, `reviewed_at`) thay vì in dạng bảng văn bản. Lệnh SHALL chỉ đọc.

#### Scenario: Mặc định chỉ lỗi chưa xem
- **WHEN** có 3 lỗi `flagged` và 1 lỗi `dismissed`, rồi chạy `nightowl review`
- **THEN** stdout có đúng 3 dòng lỗi, lỗi mới nhất đứng đầu, và một dòng cuối nêu cách xem chi tiết

#### Scenario: Lọc theo trạng thái và nguồn
- **WHEN** chạy `nightowl review --status all --source ai-self-fix`
- **THEN** chỉ có các lỗi nguồn `ai-self-fix`, ở mọi trạng thái

#### Scenario: Chưa có lỗi
- **WHEN** không có lỗi nào khớp bộ lọc
- **THEN** stdout báo không có lỗi nào và mã thoát là 0

#### Scenario: Xuất danh sách dạng JSON
- **WHEN** có các bản ghi lỗi và chạy `nightowl review --json`
- **THEN** stdout là một mảng JSON hợp lệ chứa các bản ghi lỗi phù hợp bộ lọc, mã thoát 0

### Requirement: Xem chi tiết một lỗi
`nightowl review show <id>` SHALL in file, commit, nguồn, trạng thái, loại lỗi kèm lý do và độ tin cậy nếu có, prompt, prompt phản hồi nếu có, và diff từ bản AI tới bản cuối (tối đa 200 dòng). Với cờ `--json`, stdout SHALL là một đối tượng JSON đầy đủ chứa toàn bộ chi tiết của bản ghi lỗi (kèm `prompt`, `ai_patch`, `dev_patch`, `reason`, `diff`). Lệnh SHALL chỉ đọc.

#### Scenario: Lỗi AI tự sửa
- **WHEN** chạy `nightowl review show 12` với lỗi `ai-self-fix` có prompt phản hồi
- **THEN** stdout có prompt, prompt phản hồi, và diff có dòng bắt đầu bằng `-` cho bản AI và `+` cho bản cuối

#### Scenario: Id không tồn tại
- **WHEN** chạy `nightowl review show 999` mà không có lỗi #999
- **THEN** stderr nêu `#999`, stdout rỗng, mã thoát là 1

#### Scenario: Xem chi tiết dạng JSON
- **WHEN** chạy `nightowl review show 12 --json` với lỗi #12 tồn tại
- **THEN** stdout là một đối tượng JSON hợp lệ chứa thông tin chi tiết của lỗi #12, mã thoát 0
