# release Specification

## Purpose
Phát hành `@hoanghainh/nightowl-evals` lên npm và GitHub Release từ tag git, bằng trusted publishing (không token, có provenance), chỉ khi bản đó đã qua đủ kiểm tra.

## Requirements

### Requirement: Phát hành từ tag
Khi một tag dạng `v<version>` được push, workflow release SHALL kiểm tra, build, publish package lên npm, và tạo GitHub Release cho tag đó. Không bước nào SHALL dùng token npm lưu sẵn: xác thực với npm SHALL qua trusted publishing (OIDC), kèm provenance.

#### Scenario: Release bình thường
- **WHEN** `package.json` có version `0.2.0`, commit nằm trên `main`, và tag `v0.2.0` được push
- **THEN** `@hoanghainh/nightowl-evals@0.2.0` được publish với dist-tag `latest` và có provenance, và GitHub Release `v0.2.0` được tạo kèm ghi chú tự sinh

### Requirement: Không publish bản sai
Workflow SHALL dừng trước khi publish, và không publish gì, khi tag không khớp `version` trong `package.json`, khi commit của tag không nằm trên `main`, hoặc khi typecheck, test, build, kiểm tra spec hay `npm pack --dry-run` thất bại.

#### Scenario: Tag lệch version
- **WHEN** `package.json` có version `0.2.0` và tag `v0.3.0` được push
- **THEN** workflow thất bại ở bước kiểm tra, nêu cả hai version, và không publish gì

#### Scenario: Tag ngoài main
- **WHEN** tag được gắn trên một commit chỉ có trên nhánh khác
- **THEN** workflow thất bại ở bước kiểm tra và không publish gì

#### Scenario: Test lỗi
- **WHEN** một test thất bại trên commit được gắn tag
- **THEN** workflow dừng và không publish gì

### Requirement: Bản thử không thành bản mặc định
Version có hậu tố (ví dụ `0.2.0-beta.1`) SHALL được publish với dist-tag `next`, và GitHub Release của nó SHALL được đánh dấu pre-release.

#### Scenario: Bản beta
- **WHEN** tag `v0.2.0-beta.1` được push với version khớp
- **THEN** npm có `0.2.0-beta.1` dưới dist-tag `next`, dist-tag `latest` không đổi, và GitHub Release là pre-release

### Requirement: Chạy lại an toàn
Khi version của tag đã có trên npm, workflow SHALL bỏ qua bước publish và vẫn tạo GitHub Release nếu chưa có. Khi Release đã có, bước đó cũng SHALL được bỏ qua. Khi không xác định được version hay Release đã có hay chưa (lỗi mạng, lỗi xác thực), workflow SHALL dừng thay vì đoán. Hai lần release của cùng một tag SHALL NOT chạy chồng nhau.

#### Scenario: Chạy lại sau khi bước tạo Release lỗi
- **WHEN** `0.2.0` đã có trên npm nhưng GitHub Release `v0.2.0` chưa có, rồi chạy lại workflow
- **THEN** workflow không publish lại và tạo GitHub Release `v0.2.0`

### Requirement: Quyền tối thiểu
Chỉ job publish SHALL có `id-token: write` (chạy trong environment `npm`), và chỉ job tạo GitHub Release SHALL có `contents: write`; mọi job khác chỉ có `contents: read`. Job publish SHALL NOT checkout, cài dependency hay build, mà SHALL publish đúng file `.tgz` mà job kiểm tra đã đóng gói, sau khi so khớp checksum, với `--ignore-scripts`. Action bên thứ ba SHALL được ghim theo SHA của commit.

#### Scenario: Kiểm tra quyền trong file workflow
- **WHEN** đọc `.github/workflows/release.yml`
- **THEN** quyền mặc định là `contents: read`, job publish chỉ có `id-token: write` cùng `environment: npm` và không có bước checkout hay `npm ci`, job release chỉ có `contents: write`, và mọi `uses:` có SHA 40 ký tự
