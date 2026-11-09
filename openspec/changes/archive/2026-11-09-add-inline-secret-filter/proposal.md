# Proposal: Bộ Lọc Quét và Chặn Lưu Secret Inline (Inline Secret Filter)

## Why

Hiện tại, NightOwl bảo vệ dữ liệu nhạy cảm bằng hàm `isSensitivePath` trong `src/hooks/claude-code/sensitive.ts` thông qua việc kiểm tra tên file (`.env*`, `*.pem`, `*.key`, `credentials.*`, `secrets.*`).

Tuy nhiên, lập trình viên thường có thể vô tình đưa trực tiếp (hardcode) các token, API key hoặc private key vào trong các file mã nguồn thông thường (như `config.ts`, `app.py`, `client.go`, v.v.). Nếu không có cơ chế phát hiện nội dung nhạy cảm inline:
1. Snapshot của Claude Code (`nightowl log`) sẽ lưu nguyên vẹn secret vào database cục bộ SQLite (`.nightowl/nightowl.db`).
2. Git hook (`nightowl precommit`) sẽ lưu secret trong `staged_content`.
3. Khi chạy `nightowl export` hoặc `nightowl classify --yes`, các token này có thể bị xuất ra file JSONL hoặc gửi tới LLM bên ngoài.

Việc bổ sung bộ lọc regex quét secret inline là yêu cầu cấp thiết (P0) nhằm ngăn chặn rò rỉ thông tin xác thực ngay tại tầng thu thập dữ liệu.

## What Changes

- **Bổ sung bộ quét secret inline (`containsInlineSecret`)**:
  - Nhận diện các mẫu secret phổ biến với độ chính xác cao:
    - Private Keys: `-----BEGIN (RSA|EC|DSA|OPENSSH|PGP|PRIVATE) KEY`
    - GitHub tokens: `ghp_[a-zA-Z0-9]{36}`, `github_pat_[a-zA-Z0-9_]{82}`, `gho_[a-zA-Z0-9]{36}`
    - Anthropic API keys: `sk-ant-[a-zA-Z0-9\-_]{32,}`
    - OpenAI API keys: `sk-[a-zA-Z0-9]{32,}`, `sk-proj-[a-zA-Z0-9\-_]{32,}`
    - AWS Access Keys: `\bAKIA[0-9A-Z]{16}\b`, `\bASIA[0-9A-Z]{16}\b`
    - Slack tokens: `xox[baprs]-[0-9a-zA-Z]{10,}`
    - Các mẫu gán khóa chung: `(?:api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{16,}['"]` (không phân biệt hoa thường)
- **Áp dụng tại Claude Code Hook (`nightowl log`)**:
  - Khi nội dung snapshot hoặc thay đổi (`old_string`/`new_string`) chứa secret inline, không lưu nội dung mà đánh dấu `snapshot_skipped: 'contains_secret'` và xóa nội dung khỏi payload.
- **Áp dụng tại Git Pre-commit Hook (`nightowl precommit`)**:
  - Khi nội dung staged chứa secret inline, không lưu `staged_content` mà đánh dấu `staged_skipped: 'contains_secret'`.
- **Áp dụng tại Export & Eval (`nightowl export`, `nightowl eval`)**:
  - Bỏ qua các bản ghi lỗi mà nội dung (`aiContent`, `finalContent`) chứa secret inline để không xuất ra file hoặc gửi cho mô hình.

## Capabilities

### New Capabilities

(Không có)

### Modified Capabilities

- `claude-code-hook`: Bổ sung yêu cầu chặn lưu nội dung file hoặc thay đổi khi phát hiện secret inline.
- `git-hook`: Bổ sung yêu cầu không lưu nội dung staged khi phát hiện secret inline.
- `eval-export`: Bổ sung yêu cầu bỏ qua các bản ghi lỗi chứa secret inline khi xuất dataset.

## Impact

- **Mã nguồn bị ảnh hưởng**:
  - `src/hooks/claude-code/sensitive.ts`: Thêm hàm `containsInlineSecret`.
  - `src/hooks/claude-code/to-event.ts`: Áp dụng kiểm tra secret inline khi đọc snapshot và pickInput.
  - `src/hooks/git/check-commit.ts`: Áp dụng kiểm tra secret inline cho `staged_content`.
  - `src/commands/export.ts`, `src/eval/cases.ts`: Lọc bỏ bản ghi chứa secret inline.
  - Các bài kiểm thử unit/e2e tương ứng.
- **Dependency**: Không thêm dependencies mới (sử dụng biểu thức chính quy tối ưu hiệu năng của JavaScript).
