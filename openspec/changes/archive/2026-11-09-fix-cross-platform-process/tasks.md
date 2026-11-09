# Tasks

## 1. Process Tree Termination & Windows Execution

- [x] 1.1 Triển khai hàm hủy cây tiến trình `killProcessTree` hỗ trợ Windows (`taskkill /pid <PID> /T /F` kèm fallback) và POSIX (`process.kill(-pid, 'SIGKILL')`) trong `src/classify/run-claude.ts`.
- [x] 1.2 Cập nhật `spawnClaude` trong `src/classify/run-claude.ts` để kích hoạt `windowsHide: true`, `detached: !isWindows` khi chạy trên Windows (`win32`), đảm bảo thực thi đúng và an toàn.
- [x] 1.3 Bổ sung các unit tests cho nhánh xử lý Windows và POSIX trong `test/classify/run-claude.test.ts`, xác nhận việc hủy tiến trình hoạt động đúng khi timeout hoặc khi stdout vượt quá 4 MB.

## 2. Verification

- [x] 2.1 Chạy `npm run typecheck` và `npm run build` để đảm bảo tính đúng đắn về kiểu và biên dịch dist/bin.js thành công.
- [x] 2.2 Chạy `npm run test:coverage` để đảm bảo toàn bộ bộ kiểm thử đều pass và độ bao phủ kiểm thử đạt >= 95%.
- [x] 2.3 Chạy `npm run spec:validate` để xác nhận toàn bộ OpenSpec specs và change proposal đều hợp lệ.

## Workflow follow-up

- Archive change `fix-cross-platform-process` và cập nhật main specs.
