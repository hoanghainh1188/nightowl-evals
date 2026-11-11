# Spec Delta

## MODIFIED Requirements

### Requirement: Database phải có sẵn trên runner
Action SHALL NOT tự tạo `.nightowl/` hay sync database từ máy local. Nếu thiếu `.nightowl/nightowl.db` tại working directory đã checkout, Action SHALL fail với thông báo hướng dẫn cung cấp DB (cache / download-artifact / self-hosted volume) và gợi ý `nightowl init` cục bộ rồi restore — khớp hành vi `report` không tự khởi tạo. Thông báo SHALL nhắc `.nightowl/` bị gitignore nên checkout không mang DB.

#### Scenario: Thiếu database
- **WHEN** runner không có `.nightowl/nightowl.db`
- **THEN** bước fail, stderr/log nêu thiếu DB, gợi ý restore (cache/artifact/self-hosted), và không tạo thư mục `.nightowl/` mới ngoài những gì CLI đã quy định (CLI cũng không tạo)

### Requirement: Tài liệu sử dụng
README (hoặc docs liền kề Action) SHALL có ví dụ workflow `uses:` tối thiểu, liệt kê inputs, quyền cần (`contents: read`, và `pull-requests: write` khi comment), cảnh báo `.nightowl/` bị gitignore, và **ít nhất một ví dụ restore DB chạy được về cú pháp** (ví dụ `actions/download-artifact` hoặc `actions/cache` + đường dẫn `.nightowl/nightowl.db`) trước bước `uses:` gate — không chỉ comment placeholder.

#### Scenario: Ví dụ README chạy được về mặt cú pháp
- **WHEN** người dùng copy ví dụ `uses: <owner>/<repo>/path@ref` từ README
- **THEN** YAML nêu rõ `fail-on-rate`, quyền PR comment (nếu ví dụ bật comment), và ghi chú restore DB

#### Scenario: Ví dụ restore DB cụ thể
- **WHEN** đọc README mục Action
- **THEN** có bước YAML mẫu restore/cache/download đưa `.nightowl/nightowl.db` lên runner trước gate

## ADDED Requirements

### Requirement: Cảnh báo khi DB có nhưng chưa có dữ liệu report
Khi file `.nightowl/nightowl.db` tồn tại trên runner nhưng `nightowl report` sẽ không có failure hữu ích (0 failure đã ghi), Action SHALL ghi **warning** rõ trên log (không bắt buộc fail gate chỉ vì lý do này) trước hoặc cùng lúc chạy report, gợi ý ghi failure local rồi restore DB. Action SHALL NOT bịa failure.

#### Scenario: DB trống failure
- **WHEN** runner có `nightowl.db` hợp lệ nhưng 0 failure và chạy Action
- **THEN** log có warning thiếu dữ liệu; `report` vẫn chạy theo ngưỡng hiện có (pass khi `checked == 0` như spec gate)

#### Scenario: Có failure thì không warning trống
- **WHEN** DB có ≥1 failure
- **THEN** Action không phát warning “DB trống dữ liệu report” vì lý do 0 failure
