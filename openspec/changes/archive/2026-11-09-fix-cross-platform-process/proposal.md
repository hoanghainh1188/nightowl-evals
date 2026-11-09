# Proposal: Khắc Phục Lỗi Quản Lý Tiến Trình Đa Nền Tảng (Windows Process Tree Termination)

## Why

Trong `src/classify/run-claude.ts`, NightOwl sử dụng `process.kill(-pid, 'SIGKILL')` để huỷ tiến trình `claude` cùng toàn bộ các tiến trình con khi vượt quá thời gian chờ (timeout) hoặc khi dữ liệu đầu ra stdout vượt ngưỡng an toàn (4 MB).

Trên hệ điều hành Windows:
1. `process.kill(-pid)` ném ngoại lệ vì Windows không hỗ trợ định danh nhóm tiến trình (process group) bằng số PID âm theo chuẩn POSIX.
2. Lệnh `claude` trên Windows thường được cài đặt dưới dạng `claude.cmd` hoặc `claude.ps1`. Việc `spawn('claude', ...)` mà không bật chế độ shell hoặc xử lý đuôi thực thi phù hợp sẽ thất bại với lỗi `ENOENT`.

Do đó, người dùng Windows gặp lỗi khi chạy `nightowl classify --yes` hoặc `nightowl eval --yes`. Việc khắc phục vấn đề này là điều kiện tiên quyết (P0) để sản phẩm sẵn sàng triển khai trên mọi hệ điều hành.

## What Changes

- **Huỷ cây tiến trình tương thích đa nền tảng (Cross-platform Process Tree Killing)**:
  - Trên POSIX (macOS, Linux): Giữ nguyên cơ chế `process.kill(-pid, 'SIGKILL')` với `detached: true` để dọn dẹp sạch process group.
  - Trên Windows (`win32`): Sử dụng lệnh hệ thống `taskkill /pid <PID> /T /F` để huỷ triệt để cây tiến trình của Claude Code mà không gây crash ứng dụng.
- **Khởi chạy tiến trình `claude` an toàn trên Windows**:
  - Hỗ trợ thực thi lệnh `claude` thông qua shell hoặc resolve đúng file thực thi trên Windows (`claude.cmd`), đảm bảo không bị lỗi `ENOENT` khi người dùng cài Claude Code qua npm/npx.
- **Kiểm thử**:
  - Bổ sung unit test kiểm tra nhánh xử lý riêng cho Windows và POSIX trong `test/classify/run-claude.test.ts`.

## Capabilities

### New Capabilities

(Không có)

### Modified Capabilities

- `failure-classification`: Yêu cầu "Lời gọi LLM tách biệt" được đảm bảo huỷ cả nhóm tiến trình an toàn trên cả hệ thống POSIX và Windows.
- `eval-run`: Yêu cầu "Lời gọi model tách biệt và an toàn" được đảm bảo huỷ cả nhóm tiến trình an toàn trên cả hệ thống POSIX và Windows.

## Impact

- **Mã nguồn bị ảnh hưởng**:
  - `src/classify/run-claude.ts`
  - `test/classify/run-claude.test.ts`
- **Dependency**: Không thêm dependencies mới (tận dụng các công cụ có sẵn của Node.js và OS).
- **Hành vi người dùng**: Giữ nguyên toàn bộ giao diện CLI và các flag hiện có; trải nghiệm trên macOS/Linux không thay đổi, người dùng Windows chạy ổn định.
