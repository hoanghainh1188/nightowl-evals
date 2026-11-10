# ci-pr-signals Specification

## Purpose

Thu thập tín hiệu CI fail và review PR vào store NightOwl local, liên kết commit/agent khi suy ra được, mà không bịa nội dung AI và không gọi mạng trừ khi người dùng opt-in rõ.

## Requirements

### Requirement: Ingest CI từ file local
`nightowl ingest-ci` (hoặc tên lệnh tương đương đã document) SHALL đọc một hoặc nhiều file local (JUnit XML và/hoặc JSON summary đã document), ghi sự kiện loại CI fail vào store dự án, rồi thoát 0 khi thành công. Lệnh SHALL NOT tạo database mới nếu chưa init (báo lỗi rõ, thoát ≠ 0).

#### Scenario: JUnit có test fail
- **WHEN** repo đã init và chạy ingest với fixture JUnit có ≥1 testcase failed gắn file path
- **THEN** store có ≥1 sự kiện CI; payload có tên test / message / đường dẫn khi có; thoát 0

#### Scenario: Chưa có DB
- **WHEN** chạy ingest trong repo chưa có `.nightowl/nightowl.db`
- **THEN** không tạo DB; stderr hướng dẫn init; thoát ≠ 0

### Requirement: Không bịa ai_content từ CI
Ingest CI SHALL NOT chèn hàng `failures` với `ai_content` bịa. Khi có snapshot agent gần đây khớp file/commit, lệnh MAY ghi liên kết metadata (id sự kiện / agent) trên sự kiện CI; khi không khớp, chỉ lưu quan sát CI.

#### Scenario: Không có snapshot
- **WHEN** ingest CI fail cho file không có edit agent gần đây
- **THEN** có sự kiện CI; không có failure mới với `ai_content` giả

### Requirement: Ingest PR review từ file local
`nightowl ingest-pr` (hoặc tương đương) SHALL đọc file JSON local có danh sách comment review (schema đã document), ghi sự kiện loại PR review vào store, thoát 0 khi hợp lệ. Mặc định SHALL NOT gọi GitHub API.

#### Scenario: File comment hợp lệ
- **WHEN** ingest file JSON có ≥1 review comment trên path trong repo
- **THEN** store có sự kiện PR review; thoát 0; không HTTP

### Requirement: GitHub API chỉ khi opt-in
Lệnh ingest PR MAY gọi GitHub API chỉ khi người dùng truyền cờ opt-in tường minh **và** có token môi trường đã document (ví dụ `GITHUB_TOKEN`). Không đủ điều kiện SHALL fail rõ hoặc bỏ qua đường API, không gọi mạng im lặng.

#### Scenario: Không opt-in thì không mạng
- **WHEN** chạy ingest-pr chỉ với `--file` local
- **THEN** không mở kết nối mạng

#### Scenario: Opt-in thiếu token
- **WHEN** bật cờ GitHub nhưng thiếu token
- **THEN** thoát ≠ 0 với thông báo; không ghi sự kiện giả từ API

### Requirement: Idempotent theo khóa tự nhiên
Ingest lặp lại cùng nguồn (cùng fingerprint test fail hoặc cùng comment id) SHALL NOT nhân bản sự kiện vô hạn; lần hai giữ số đếm ổn định hoặc cập nhật cùng bản ghi theo design.

#### Scenario: Chạy JUnit hai lần
- **WHEN** ingest cùng file JUnit hai lần liên tiếp
- **THEN** số sự kiện CI tương ứng fingerprint không tăng gấp đôi sau lần hai
