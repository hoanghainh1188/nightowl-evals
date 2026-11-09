# Design: Khắc Phục Lỗi Quản Lý Tiến Trình Đa Nền Tảng

## Context

Trong `src/classify/run-claude.ts`:
- Tiến trình `claude` được khởi chạy bằng `spawn('claude', [...args], { detached: true, ... })`.
- Khi vượt quá thời hạn hoặc dung lượng đầu ra, `killGroup(child.pid)` gọi `process.kill(-pid, 'SIGKILL')`.
- Trên POSIX (macOS, Linux), PID âm biểu thị process group id, giải phóng sạch sẽ cả tiến trình con.
- Trên Windows, Node.js không hỗ trợ số âm cho `process.kill` và sẽ ném lỗi. Đồng thời, các command cài qua npm trên Windows là file script (`.cmd`/`.ps1`), cần cơ chế khởi chạy tương thích.

## Goals / Non-Goals

**Goals:**
- Dừng hoàn toàn tiến trình `claude` và các tiến trình con trên cả Windows và POSIX khi gặp timeout hoặc stdout > 4 MB.
- Giữ vững nguyên tắc **Zero runtime dependencies**: không thêm thư viện ngoài vào `dependencies`.
- Đảm bảo kiểm thử tự động (unit tests) có thể verify được cả nhánh POSIX và Windows trên môi trường phát triển hiện tại (macOS/Linux CI).

**Non-Goals:**
- Không thay đổi giao diện hàm `runClaude(prompt, options)`.
- Không can thiệp vào cơ chế bảo vệ stdin/stdout hay các tham số bảo mật của `claudeArgs`.

## Decisions

### Quyết định 1: Cơ chế huỷ cây tiến trình theo hệ điều hành (OS-aware Process Tree Killing)
- **Lựa chọn**:
  - Trên POSIX (`process.platform !== 'win32'`): Tiếp tục dùng `process.kill(-pid, 'SIGKILL')` với `detached: true`.
  - Trên Windows (`process.platform === 'win32'`): Gọi lệnh hệ thống có sẵn của Windows `taskkill /pid <PID> /T /F` thông qua `spawnSync`. Nếu `taskkill` thất bại (hoặc không khả dụng), fallback về `process.kill(pid, 'SIGKILL')`.
- **Lý do**:
  - `taskkill` có sẵn trên mọi phiên bản Windows hiện đại, cờ `/T` huỷ toàn bộ tiến trình con (tree), cờ `/F` ép buộc huỷ ngay.
  - Tránh phải cài đặt thêm thư viện bên thứ ba như `tree-kill` vào production bundle.

### Quyết định 2: Hỗ trợ khởi chạy lệnh `claude` trên Windows
- **Lựa chọn**: Trên Windows (`win32`), thiết lập `shell: true` trong tùy chọn `spawn`.
- **Đánh giá an toàn**:
  - Lỗ hổng command injection với `shell: true` chỉ xảy ra khi tham số dòng lệnh chứa chuỗi không tin cậy từ người dùng.
  - Trong NightOwl, mảng tham số (`claudeArgs`) là các hằng số tĩnh và cờ cấu hình cố định; nội dung `prompt` được truyền hoàn toàn qua luồng `child.stdin`, không nằm trong tham số dòng lệnh. Do đó, việc bật `shell: true` trên Windows là an toàn tuyệt đối.

### Quyết định 3: Thiết kế DI (Dependency Injection) cho kiểm thử
- **Lựa chọn**: Cho phép `spawnClaude` nhận các hàm trừu tượng có thể inject phục vụ test:
  - `platform`: mặc định đọc `process.platform`.
  - `killProcessTree`: hàm huỷ cây tiến trình.
  - `spawnProcess`: hàm khởi chạy tiến trình.
- **Lý do**: Cho phép unit tests trên macOS giả lập môi trường Windows một cách đáng tin cậy mà không cần máy ảo Windows.

## Risks / Trade-offs

- **[Risk]** `taskkill` có thể bị chặn bởi chính sách bảo mật nội bộ (Group Policy) trên một số máy Windows doanh nghiệp.  
  → **Mitigation**: Bọc lời gọi `taskkill` trong khối `try/catch` và fallback về `process.kill(child.pid)`.
