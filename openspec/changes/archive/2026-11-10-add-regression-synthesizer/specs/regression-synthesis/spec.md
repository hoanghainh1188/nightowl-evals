## Purpose

Biến failure AI đã ghi (ưu tiên `confirmed`) thành khung fixture/test hồi quy local để đưa vào suite dự án, không gửi dữ liệu ra ngoài trừ khi người dùng opt-in LLM.

## ADDED Requirements

### Requirement: Lệnh suggest-regressions đọc failure local
`nightowl suggest-regressions` SHALL đọc failure từ store dự án (không tạo DB nếu chưa có), áp bộ lọc trạng thái/category/agent/thời gian, và sinh một hoặc nhiều khung regression (preview hoặc file) từ dữ liệu failure đó.

#### Scenario: Có failure confirmed
- **WHEN** store có ≥1 failure `confirmed` và chạy `nightowl suggest-regressions`
- **THEN** lệnh thoát 0 và stdout (hoặc file output) chứa khung regression liên quan tới failure đó

#### Scenario: Chưa init / không có DB
- **WHEN** chạy lệnh trong repo chưa có `.nightowl/`
- **THEN** stderr hướng dẫn init hoặc báo không có dữ liệu; thoát mã khác 0; không tạo DB

### Requirement: Mặc định không LLM và không ghi suite dự án
Không có cờ opt-in LLM, lệnh SHALL chỉ dùng template local. Không có cờ ghi tường minh, lệnh SHALL NOT tạo/sửa file trong cây test của dự án (chỉ preview stdout).

#### Scenario: Dry mặc định
- **WHEN** chạy `nightowl suggest-regressions` không opt-in LLM và không chỉ path ghi
- **THEN** chỉ preview; không gọi mạng; không tạo file test mới trong repo

### Requirement: Ghi file chỉ khi chỉ định rõ
Chỉ khi có tuỳ chọn ghi tường minh (ví dụ `--output <dir|file>`), lệnh SHALL ghi khung regression theo chế độ đã document. SHALL từ chối ghi đè file không phải artifact NightOwl đã biết trừ khi `--force`.

#### Scenario: Write vào thư mục
- **WHEN** `nightowl suggest-regressions --output test/regressions`
- **THEN** tạo một hoặc nhiều file khung dưới đường dẫn đó; stderr có thể xác nhận số file đã ghi

### Requirement: Định dạng khung ổn định và tái dùng eval
Mỗi khung SHALL mang định danh ổn định gắn failure (cùng tinh thần `nightowl.eval/v1` id) và SHALL gồm đủ thông tin để tái hiện `rejected` / `expected` (và metadata cần thiết), để người dùng có thể commit vào suite hoặc chạy lại sau.

#### Scenario: Cùng failure hai lần
- **WHEN** chạy ghi hai lần cho cùng failure với cùng tuỳ chọn
- **THEN** định danh artifact giống nhau (trừ khi `--force` thay nội dung theo chính sách đã document)

### Requirement: Không lộ secret trong khung
Nội dung khung SHALL NOT chứa secret inline đã lọc (cùng chính sách snapshot/export). Failure path nhạy cảm hoặc nội dung khớp bộ lọc secret SHALL bị bỏ qua và được báo trên stderr.

#### Scenario: Failure chứa secret
- **WHEN** failure được chọn có nội dung khớp bộ lọc secret
- **THEN** không có khung chứa chuỗi secret đó; stderr phản ánh bản ghi bị bỏ

### Requirement: LLM opt-in chỉ diễn đạt
The command SHALL NOT call an LLM unless the user opts in. When opted in, the command SHALL only use the model to rephrase titles or descriptions of already-selected, sanitized scaffolds.

#### Scenario: Không opt-in thì không gọi model
- **WHEN** chạy không opt-in LLM
- **THEN** không spawn `claude` và không gọi Anthropic API
