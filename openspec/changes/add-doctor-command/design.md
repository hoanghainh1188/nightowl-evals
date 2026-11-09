# Design: Lệnh Chẩn Đoán Môi Trường và Cấu Hình (nightowl doctor)

## Context

NightOwl dựa trên nhiều thành phần hệ thống để hoạt động âm thầm:
- Node.js runtime phiên bản hiện đại (yêu cầu `>= 22.13.0` để hỗ trợ `node:sqlite`).
- Git repository ở thư mục gốc hoặc cha của thư mục làm việc.
- Cấu hình Claude Code hook trong `.claude/settings.local.json` hoặc `.claude/settings.json`.
- Git hooks (`pre-commit`, `post-commit`) trong `.git/hooks/`.
- File SQLite database `.nightowl/nightowl.db`.

Nếu một trong các thành phần này chưa được cấu hình hoặc bị hỏng, sự kiện code AI hoặc commit check sẽ bị bỏ sót mà không có thông báo lỗi trực tiếp (do nguyên tắc fail-open của hook). Lệnh `nightowl doctor` đóng vai trò là công cụ kiểm tra sức khỏe và chẩn đoán toàn diện hệ thống.

## Goals / Non-Goals

**Goals:**
- Kiểm tra 5 thành phần cốt lõi: Node runtime & sqlite, Git repository & git binary, Claude Code hook, Git hooks, SQLite storage & database health.
- Thiết kế theo mô hình Dependency Injection (`DoctorDeps`) để kiểm thử độc lập (unit test) mọi trạng thái giả lập dễ dàng mà không làm thay đổi hệ thống.
- Phân định 3 mức độ trạng thái: `ok` (đạt), `warn` (cảnh báo cấu hình chưa đầy đủ hoặc khuyến nghị), `fail` (lỗi nghiêm trọng).
- Hỗ trợ cờ `--strict`: Thoát mã 1 khi xuất hiện cảnh báo (`warn`) hoặc lỗi (`fail`).
- Đưa ra hướng dẫn khắc phục cụ thể (remedy) cho từng mục chưa đạt.

**Non-Goals:**
- Không tự động ghi đè hoặc sửa chữa (auto-fix) cấu hình trong lệnh `doctor` (người dùng dùng `nightowl init` để sửa/cài đặt).
- Không thực hiện bất kỳ lệnh gọi mạng nào (giữ vững nguyên tắc bảo mật và offline 100%).

## Decisions

### Quyết định 1: Cấu trúc kết quả chẩn đoán theo nhóm (Structured Diagnostics)
- **Lựa chọn**: Định nghĩa kiểu `DoctorCheckItem`:
  ```ts
  export interface DoctorCheckItem {
    readonly category: 'runtime' | 'git' | 'claude' | 'hooks' | 'storage';
    readonly name: string;
    readonly status: 'ok' | 'warn' | 'fail';
    readonly message: string;
    readonly remedy?: string;
  }
  ```
- **Lý do**: Cho phép render giao diện trực quan theo từng phần, dễ dàng tính toán tổng số lỗi/cảnh báo và xác định mã thoát chính xác.

### Quyết định 2: Dependency Injection cho Testability
- **Lựa chọn**: Cung cấp interface `DoctorDeps`:
  - `nodeVersion: () => string`
  - `cwd: () => string`
  - `loadSqlite: () => Promise<unknown>`
  - `findProjectRoot: (cwd: string) => string | null`
  - `readSettings: typeof readSettings`
  - `isOnPath: (cmd: string) => boolean`
  - `inspectGit: (root: string) => Promise<...>`
  - `inspectDatabase: (root: string) => Promise<...>`
- **Lý do**: Giúp unit test bao phủ toàn bộ các kịch bản môi trường (Node cũ < 22.13, thiếu sqlite, database corrupt, hooks thiếu quyền execute, v.v.) mà không cần can thiệp môi trường Node hay Git của máy thật.

### Quyết định 3: Quy tắc xác định mã thoát (Exit Code Policy)
- **Lựa chọn**:
  - `fail`: Bất kỳ lỗi nghiêm trọng nào (Node < 22.13, không thể tải `node:sqlite`, không tìm thấy git repository, database bị hỏng) khiến lệnh thoát mã `1`.
  - `warn`: Dự án chưa chạy `nightowl init`, hoặc chưa có `claude` CLI trên PATH. Lệnh thoát mã `0` (trừ khi có cờ `--strict`).
  - `--strict`: Nếu có bất kỳ `warn` hoặc `fail`, lệnh thoát mã `1`.

## Risks / Trade-offs

- **[Risk]** Kiểm tra tính toàn vẹn của SQLite trên database lớn có thể làm chậm terminal.  
  → **Mitigation**: Sử dụng `PRAGMA quick_check` (hoặc `PRAGMA schema_version`) thay vì quét toàn bộ B-tree nặng nề, đảm bảo thời gian chạy chỉ trong vài mili-giây.
- **[Risk]** Khác biệt giữa Windows và POSIX về đường dẫn và quyền thực thi file hook.  
  → **Mitigation**: Dùng các helper chuẩn từ `src/setup/git-hook.ts` và kiểm tra quyền qua `fs.promises.access(X_OK)` có fallback cho Windows.
