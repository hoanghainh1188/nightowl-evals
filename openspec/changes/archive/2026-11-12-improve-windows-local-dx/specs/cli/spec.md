# Spec Delta

## ADDED Requirements

### Requirement: Document Windows path và permission limits
Tài liệu người dùng (README và/hoặc `--help` của `init` / `doctor` khi phù hợp) SHALL nêu ngắn rằng trên Windows: (1) path `\` được chuẩn hóa tương đương `/` cho module/workspace; (2) quyền thư mục `.nightowl/` là best-effort trên NTFS; (3) git hook không phụ thuộc execute-bit POSIX. SHALL NOT yêu cầu WSL.

#### Scenario: README nêu Windows DX
- **WHEN** đọc README mục setup/doctor hoặc tương đương sau change
- **THEN** có đoạn mô tả giới hạn/hành vi Windows path hoặc permission hoặc hook như trên
