# Spec Delta

## ADDED Requirements

### Requirement: Doctor kiểm tra workspace monorepo
Khi repo có cấu hình workspace đã hỗ trợ (`package.json` `workspaces` và/hoặc `pnpm-workspace.yaml`), `nightowl doctor` SHALL chạy discovery local (không gọi mạng) và SHALL báo **cảnh báo** nếu discovery trả về tập rỗng (config có nhưng không resolve được package). Khi discovery tìm thấy ≥1 package, SHALL báo ok kèm số package (hoặc tương đương đã document). Khi không có cấu hình workspace, SHALL NOT thêm cảnh báo workspace giả. `--strict` SHALL coi cảnh báo workspace như các warn khác.

#### Scenario: Config workspace nhưng discovery rỗng
- **WHEN** repo có `package.json` `workspaces: ["packages/*"]` (hoặc `pnpm-workspace.yaml`) nhưng không có package dir khớp, chạy `nightowl doctor`
- **THEN** stdout có cảnh báo workspace discovery rỗng; thoát 0 (không `--strict`)

#### Scenario: Monorepo có package
- **WHEN** discovery tìm thấy ≥1 package root và chạy `nightowl doctor`
- **THEN** stdout có dòng ok về workspace/packages; thoát 0 nếu không lỗi khác

#### Scenario: Không phải monorepo
- **WHEN** repo không có cấu hình workspace đã hỗ trợ và chạy `nightowl doctor`
- **THEN** không có cảnh báo “workspace discovery” vì thiếu config

### Requirement: Doctor xác minh hook/agent authenticity
Ngoài kiểm tra tồn tại file cấu hình, `nightowl doctor` SHALL xác minh cấu trúc tối thiểu mà tool/hook manager đọc được trên máy: file JSON agent (khi dùng) parse được và chứa entry NightOwl đã document; git hook (hoặc hook manager) gọi đúng lệnh NightOwl tương ứng; khi hook file tồn tại trên POSIX, SHALL cảnh báo nếu không executable (Windows: bỏ qua hoặc document no-op quyền execute). Thiếu authenticity SHALL là cảnh báo, không fail nghiêm trọng, trừ `--strict`.

#### Scenario: Cursor JSON hỏng
- **WHEN** `.cursor/hooks.json` tồn tại nhưng không phải JSON hợp lệ và chạy `nightowl doctor`
- **THEN** cảnh báo authenticity/parse Cursor; thoát 0 (không `--strict`)

#### Scenario: Git hook thiếu execute bit trên POSIX
- **WHEN** trên môi trường POSIX, hook `.git/hooks/pre-commit` gọi NightOwl nhưng không executable, chạy `nightowl doctor`
- **THEN** stdout cảnh báo quyền thực thi hook; thoát 0 (không `--strict`)

### Requirement: Doctor tóm tắt sẵn sàng report cho team
Khi database tồn tại và toàn vẹn, `nightowl doctor` SHALL in tóm tắt readiness gồm: số failure không dismissed (reportable), và đếm signals đã document (`ci-fail`, `pr-review`, `revert`) trên toàn store hoặc cửa sổ mặc định đã document — không lộ tên/email developer. Cảnh báo “thiếu dữ liệu cho report” hiện có (0 reportable failure) SHALL được giữ. Khi có reportable failure nhưng 0 signal, SHALL NOT fail; MAY ghi nhận signals = 0 trong tóm tắt (ok hoặc info trong cùng dòng thống kê).

#### Scenario: Có failure và signals
- **WHEN** DB có ≥1 failure không dismissed và ≥1 sự kiện signal, chạy `nightowl doctor`
- **THEN** stdout nêu số failure reportable và đếm signals > 0 (hoặc từng kind); không cảnh báo “No failures recorded yet”

#### Scenario: Có failure nhưng chưa có signal
- **WHEN** DB có ≥1 failure reportable và 0 signal events, chạy `nightowl doctor`
- **THEN** tóm tắt readiness phản ánh signals 0; thoát 0 nếu không warn/fail khác bắt buộc
