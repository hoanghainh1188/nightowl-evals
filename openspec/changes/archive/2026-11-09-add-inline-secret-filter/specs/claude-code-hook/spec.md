# Spec Delta

## MODIFIED Requirements

### Requirement: Không lưu nội dung file nhạy cảm
Với file có tên thuộc nhóm bí mật (ví dụ `.env*`, `*.pem`, `*.key`, `id_rsa`, `.npmrc`, `credentials`, `secrets.*`), file bị git bỏ qua theo `.gitignore`, hoặc nội dung chứa secret inline (như private keys, API token), `nightowl log` SHALL lưu sự kiện `edit` chỉ với đường dẫn và lý do bỏ qua (`sensitive`, `ignored` hoặc `contains_secret`), SHALL NOT lưu nội dung file hay phần thay đổi.

#### Scenario: AI sửa .env
- **WHEN** AI dùng Edit đổi `API_KEY` trong `.env`
- **THEN** sự kiện `edit` có `snapshot_skipped` bằng `sensitive` và database không chứa giá trị của khoá

#### Scenario: File bị .gitignore bỏ qua
- **WHEN** AI ghi `build/out.js` và `.gitignore` có `build/`
- **THEN** sự kiện `edit` có `snapshot_skipped` bằng `ignored` và không có nội dung file

#### Scenario: File chứa inline secret
- **WHEN** AI sửa một file mã nguồn bình thường nhưng nội dung có chứa private key hoặc API token (như sk-ant-, ghp_)
- **THEN** sự kiện có `payload.snapshot: null`, `payload.snapshot_skipped: "contains_secret"`, và không lưu nội dung thay đổi
