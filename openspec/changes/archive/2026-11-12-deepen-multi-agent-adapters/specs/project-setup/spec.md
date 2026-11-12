# Spec Delta

## ADDED Requirements

### Requirement: Doctor kiểm tra shape cấu hình best-effort
Ngoài tồn tại file/marker, `nightowl doctor` SHALL kiểm tra shape tối thiểu đã document cho mỗi agent `best-effort` có đường cấu hình (ít nhất Windsurf hooks events NightOwl; Cline/Roo marker có `nightowl` + `command` gọi NightOwl). File parse được nhưng thiếu entry/event bắt buộc SHALL cảnh báo authenticity/shape (không fail nghiêm trọng trừ `--strict`). Agent `manual` SHALL NOT bị báo “missing native hook file”.

#### Scenario: Windsurf thiếu event hook NightOwl
- **WHEN** `.windsurf/hooks.json` tồn tại JSON hợp lệ nhưng thiếu entry NightOwl trên event đã document, chạy `nightowl doctor`
- **THEN** stdout cảnh báo shape/authenticity Windsurf; thoát 0 (không `--strict`)

#### Scenario: Cline marker thiếu command NightOwl
- **WHEN** `.cline/nightowl.json` tồn tại nhưng không có command/marker NightOwl hợp lệ, chạy `nightowl doctor`
- **THEN** cảnh báo shape Cline; thoát 0 (không `--strict`)

### Requirement: init ghi cấu hình best-effort đúng contract sâu hơn
Khi `nightowl init` cài agent `best-effort` có đường cấu hình, lệnh SHALL ghi đúng contract đã document (Windsurf: events hook + lệnh NightOwl; Cline/Roo: marker `nightowl` + command + agent id) và idempotent. SHALL NOT ghi file trống hoặc marker không đủ field tối thiểu đã document.

#### Scenario: init Windsurf tạo đủ event
- **WHEN** `nightowl init --agents windsurf` trong repo chưa có NightOwl Windsurf hooks
- **THEN** `.windsurf/hooks.json` có entry NightOwl trên các event đã document; exit 0

#### Scenario: init Cline marker đủ field
- **WHEN** `nightowl init --agents cline` (maturity best-effort)
- **THEN** `.cline/nightowl.json` chứa marker `nightowl` và command gọi `nightowl log`; exit 0
