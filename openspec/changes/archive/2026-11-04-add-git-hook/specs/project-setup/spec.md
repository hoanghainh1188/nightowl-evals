# Spec Delta

## ADDED Requirements

### Requirement: Cài git hook pre-commit
`nightowl init` SHALL đảm bảo hook `pre-commit` của repo gọi `nightowl precommit` theo cách không bao giờ làm commit thất bại. Hook chưa có SHALL được tạo mới và cho phép thực thi. Hook shell có sẵn SHALL được giữ nguyên nội dung, chỉ thêm dòng gọi NightOwl ngay sau dòng shebang. Chạy lại `init` SHALL không thêm trùng.

#### Scenario: Chưa có hook
- **WHEN** chạy `nightowl init` trong repo chưa có `.git/hooks/pre-commit`
- **THEN** file được tạo, có quyền thực thi, và gọi `nightowl precommit`

#### Scenario: Đã có hook shell khác
- **WHEN** `.git/hooks/pre-commit` là script `sh` chạy `npm run lint`, rồi chạy `nightowl init`
- **THEN** hook vẫn chạy `npm run lint` như cũ và có thêm dòng gọi `nightowl precommit`

#### Scenario: Chạy init hai lần
- **WHEN** chạy `nightowl init` hai lần
- **THEN** hook chỉ có một dòng gọi `nightowl precommit`

#### Scenario: nightowl bị gỡ khỏi máy
- **WHEN** hook đã cài nhưng lệnh `nightowl` không còn trong `PATH`, và dev chạy `git commit`
- **THEN** commit thành công như không có NightOwl

### Requirement: Không sửa hook do công cụ khác quản lý
Khi repo đặt `core.hooksPath`, hoặc hook `pre-commit` có sẵn không phải script shell, `nightowl init` SHALL NOT sửa file hook nào, và SHALL in ra stderr dòng lệnh cần tự thêm vào hook `pre-commit`, rồi thoát mã 0.

#### Scenario: Repo dùng husky
- **WHEN** `core.hooksPath` là `.husky` và chạy `nightowl init`
- **THEN** không file nào trong `.husky/` bị sửa, stderr có hướng dẫn thêm dòng gọi `nightowl precommit`, mã thoát 0

#### Scenario: Hook viết bằng Node
- **WHEN** `.git/hooks/pre-commit` bắt đầu bằng `#!/usr/bin/env node`
- **THEN** file không bị sửa và stderr có hướng dẫn thêm dòng gọi
