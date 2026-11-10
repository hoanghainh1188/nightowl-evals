# Spec Delta

## Purpose

Đóng gói composite GitHub Action để team bật CI quality gate NightOwl và (tuỳ chọn) sticky comment báo cáo AI Coding Health trên Pull Request mà không copy-paste nhiều bước thủ công.

## ADDED Requirements

### Requirement: Composite Action đóng gói quality gate
Repo SHALL cung cấp composite GitHub Action với `action.yml` công khai: cài `@hoanghainh/nightowl-evals`, chạy `nightowl report` với `--json` và `--fail-on-rate`, ghi báo cáo ra file output, và truyền mã thoát của `report` ra job (fail khi vượt ngưỡng).

#### Scenario: Gate fail khi vượt ngưỡng
- **WHEN** workflow dùng Action với `fail-on-rate` và database có tỷ lệ vượt ngưỡng
- **THEN** bước Action kết thúc thất bại (mã thoát khác 0) và file báo cáo JSON vẫn được ghi nếu bước ghi đã chạy

#### Scenario: Gate pass trong ngưỡng hoặc chưa có dữ liệu kiểm tra
- **WHEN** tỷ lệ trong ngưỡng hoặc `changedRate.checked == 0`
- **THEN** bước Action kết thúc thành công (mã thoát 0) và file báo cáo JSON tồn tại tại đường dẫn output đã cấu hình

### Requirement: Inputs cấu hình được
Action SHALL chấp nhận input tối thiểu: `fail-on-rate` (mặc định hợp lệ trong 0–100), `since` (tuỳ chọn), `output-path`, `nightowl-version` (tag/version npm hoặc `latest`), và cờ bật/tắt sticky PR comment. Input không hợp lệ SHALL làm bước fail rõ ràng trước khi gọi `report` khi Action tự validate; nếu không validate thì ủy thác lỗi parse của CLI.

#### Scenario: Dùng mặc định fail-on-rate
- **WHEN** workflow không truyền `fail-on-rate`
- **THEN** Action dùng mặc định đã document (ví dụ `25`) và vẫn chạy `nightowl report --fail-on-rate <mặc định>`

#### Scenario: Ghim phiên bản npm
- **WHEN** truyền `nightowl-version` là semver công bố trên npm
- **THEN** Action cài đúng phiên bản đó thay vì luôn `latest`

### Requirement: Sticky comment trên Pull Request
Khi cờ comment bật và sự kiện là `pull_request` (hoặc có `GITHUB_TOKEN` + số PR), Action SHALL đăng hoặc cập nhật **một** sticky comment mang marker cố định (ví dụ `<!-- nightowl-evals-report -->`) với bảng tóm tắt từ JSON báo cáo (tổng lỗi, changed rate, top module/category nếu có). Khi không phải PR hoặc comment tắt, Action SHALL NOT gọi GitHub API comment.

#### Scenario: Cập nhật comment cũ thay vì spam
- **WHEN** PR đã có comment NightOwl với marker và chạy lại Action
- **THEN** cùng một comment được cập nhật nội dung mới; không tạo thêm comment trùng marker

#### Scenario: Comment tắt
- **WHEN** input comment = false
- **THEN** Action không tạo/sửa comment PR và chỉ chạy gate + ghi file

### Requirement: Database phải có sẵn trên runner
Action SHALL NOT tự tạo `.nightowl/` hay sync database từ máy local. Nếu thiếu `.nightowl/nightowl.db` tại working directory đã checkout, Action SHALL fail với thông báo hướng dẫn cung cấp DB (cache/artifact/self-hosted) và gợi ý `nightowl init` / restore — khớp hành vi `report` không tự khởi tạo.

#### Scenario: Thiếu database
- **WHEN** runner không có `.nightowl/nightowl.db`
- **THEN** bước fail, stderr/log nêu thiếu DB và không tạo thư mục `.nightowl/` mới ngoài những gì CLI đã quy định (CLI cũng không tạo)

### Requirement: Không telemetry NightOwl; chỉ GitHub API khi comment
Binary `nightowl` do Action gọi SHALL NOT gửi dữ liệu tới máy chủ NightOwl hay bên thứ ba ngoài GitHub. Chỉ bước comment (khi bật) MAY gọi GitHub API với token do workflow cấp. Action SHALL NOT thu thập telemetry riêng.

#### Scenario: Gate-only không gọi API ngoài GitHub package registry cần thiết để cài npm
- **WHEN** comment tắt và chỉ chạy report
- **THEN** ngoài việc cài package từ registry npm đã cấu hình, không có HTTP tới endpoint NightOwl; không upload DB ra ngoài trừ artifact mà workflow người dùng tự thêm

### Requirement: Tài liệu sử dụng
README (hoặc docs liền kề Action) SHALL có ví dụ workflow `uses:` tối thiểu, liệt kê inputs, quyền cần (`contents: read`, và `pull-requests: write` khi comment), và cảnh báo `.nightowl/` bị gitignore nên phải restore DB trước gate.

#### Scenario: Ví dụ README chạy được về mặt cú pháp
- **WHEN** người dùng copy ví dụ `uses: <owner>/<repo>/path@ref` từ README
- **THEN** YAML nêu rõ `fail-on-rate`, quyền PR comment (nếu ví dụ bật comment), và ghi chú restore DB
