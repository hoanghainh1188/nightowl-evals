# Design: Bộ Lọc Quét và Chặn Lưu Secret Inline

## Context

Trong `src/hooks/claude-code/sensitive.ts`, hàm `isSensitivePath` chỉ lọc các file có tên nằm trong danh sách đen (`.env`, `credentials`, `*.pem`, v.v.). Nếu lập trình viên gõ trực tiếp secret (như API key, token truy cập) trong một file mã nguồn bình thường (`src/config.ts`), hệ thống hiện tại sẽ lưu trọn vẹn secret đó vào snapshot SQLite và các bản ghi lỗi.

## Goals / Non-Goals

**Goals:**
- Ngăn chặn lưu trữ nội dung bí mật (API key, token, private key) vào SQLite trong các sự kiện `edit` và `commit-check`.
- Ngăn chặn xuất hoặc gửi các bản ghi lỗi chứa secret ra file JSONL (`nightowl export`) hoặc tới LLM (`nightowl classify`, `nightowl eval`).
- Tốc độ xử lý cực nhanh (< 2ms) bằng các biểu thức chính quy được tiền biên dịch (precompiled regexes), không ảnh hưởng tới giới hạn thời gian (budget 2s) của git hook.

**Non-Goals:**
- Không sử dụng các thuật toán tính entropy ngẫu nhiên phức tạp (dễ gây dương tính giả và tốn CPU).
- Không tự động sửa hay xóa code của người dùng trên ổ đĩa.

## Decisions

### Quyết định 1: Danh sách mẫu nhận diện bí mật (High-precision Pattern Set)
- **Lựa chọn**: Sử dụng mảng regex tiền biên dịch bao quát các định dạng token phổ biến và khóa riêng tư:
  1. Private Keys: `/-----BEGIN\s+([A-Z0-9_\s]+)\s+KEY/i`
  2. GitHub tokens: `/\bgh[pousr]_[A-Za-z0-9_]{36,}\b/` và `/\bgithub_pat_[A-Za-z0-9_]{82}\b/`
  3. Anthropic API Keys: `/\bsk-ant-[A-Za-z0-9_\-]{32,}\b/`
  4. OpenAI API Keys: `/\bsk-(?:proj-)?[A-Za-z0-9_\-]{32,}\b/`
  5. AWS Access Keys: `/\bA[K|S]IA[0-9A-Z]{16}\b/`
  6. Slack tokens: `/\bxox[baprs]-[A-Za-z0-9\-]{10,}\b/`
  7. Generic assignments: `/(?:api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['"][A-Za-z0-9_\-\.]{16,}['"]/i`
- **Lý do**: Đạt tỷ lệ phát hiện cao với các loại token thực tế thường gặp nhất khi lập trình viên tích hợp dịch vụ AI và đám mây, trong khi thời gian khớp regex trên văn bản < 512 KB chỉ tính bằng micro giây.

### Quyết định 2: Điểm chặn tại các tầng xử lý (Enforcement Points)
1. **`toEvent` (`src/hooks/claude-code/to-event.ts`)**:
   - Khi đọc snapshot từ đĩa: Nếu `containsInlineSecret(snapshot)` trả về `true`, đặt `snapshot = null` và `snapshot_skipped = 'contains_secret'`.
   - Khi xử lý `pickInput`: Nếu `old_string` hoặc `new_string` chứa secret inline, thay bằng `{ skipped: 'contains_secret' }`.
2. **`commitCheck` (`src/hooks/git/check-commit.ts`)**:
   - Nếu `containsInlineSecret(staged.content)` trả về `true`, đặt `staged_content = null` và `staged_skipped = 'contains_secret'`.
3. **`export` và `eval` (`src/commands/export.ts`, `src/eval/cases.ts`)**:
   - Bổ sung điều kiện kiểm tra `containsInlineSecret(failure.aiContent) || containsInlineSecret(failure.finalContent)` để loại trừ bản ghi lỗi, tương tự như `isSensitivePath`.

## Risks / Trade-offs

- **[Risk]** Token giả trong các file test (ví dụ `sk-ant-mock-key-for-test-1234567890`) có thể bị nhận diện là secret và bỏ qua snapshot.  
  → **Mitigation**: Đối với việc bảo mật, ưu tiên an toàn (fail-safe): việc bỏ qua snapshot của một file test không làm hỏng commit hay workflow của dev, nhưng bảo vệ an toàn tuyệt đối trước nguy cơ rò rỉ secret thật.
