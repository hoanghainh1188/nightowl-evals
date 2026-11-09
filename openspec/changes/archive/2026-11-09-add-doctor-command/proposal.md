# Proposal: Lệnh Chẩn Đoán Môi Trường và Cấu Hình (nightowl doctor)

## Why

Lập trình viên khi cài đặt NightOwl Evals thường gặp các vấn đề về cấu hình môi trường khiến việc ghi nhận sự kiện không hoạt động (ví dụ: Node.js không tương thích < 22.13, Claude Code hooks chưa được đăng ký trong settings, Git hooks bị chặn hoặc chưa cấp quyền thực thi, hoặc cơ sở dữ liệu SQLite bị lỗi quyền truy cập/hỏng cấu trúc). Hiện tại, người dùng chỉ có thể phỏng đoán hoặc đọc log thủ công. Lệnh `nightowl doctor` cung cấp một công cụ tự chẩn đoán toàn diện, phát hiện ngay lập tức các thiếu sót cấu hình và đưa ra hướng dẫn khắc phục cụ thể.

## What Changes

- Bổ sung lệnh con `nightowl doctor` chẩn đoán hệ thống theo 5 nhóm kiểm tra:
  1. **Node.js & Runtime**: Kiểm tra phiên bản Node (yêu cầu `>= 22.13.0`) và tính khả dụng của module chuẩn `node:sqlite`.
  2. **Git Repository**: Kiểm tra thư mục làm việc hiện tại có thuộc git repository hợp lệ và lệnh `git` có khả dụng hay không.
  3. **Claude Code Hooks**: Kiểm tra sự hiện diện của hooks `PostToolUse` và `UserPromptSubmit` trong `.claude/settings.local.json` (hoặc `.claude/settings.json`), đảm bảo file cá nhân được gitignore đúng quy cách.
  4. **Git Hooks**: Kiểm tra các hook `pre-commit` và `post-commit` trong `.git/hooks/` (hoặc `core.hooksPath`), kiểm tra quyền thực thi và lệnh gọi `nightowl precommit`/`nightowl postcommit`.
  5. **NightOwl Storage & Database**: Kiểm tra thư mục `.nightowl/`, quyền truy cập file, tính toàn vẹn của database `nightowl.db` (`PRAGMA integrity_check`), phiên bản schema hiện tại, và thống kê tổng số sự kiện/lỗi.
- Bổ sung cờ `--strict`: Nếu có bất kỳ cảnh báo (warning) hoặc lỗi (error) nào, lệnh thoát mã `1`. Mặc định (không có `--strict`), lệnh thoát mã `0` nếu không có lỗi nghiêm trọng (fatal error), chỉ cảnh báo các khuyến nghị.
- Tự động hiển thị kết quả trực quan trên terminal với ký hiệu rõ ràng (`✓` OK, `!` Warning, `✗` Fail) cùng thông điệp hướng dẫn giải quyết.

## Capabilities

### Modified Capabilities
- `cli`: Bổ sung `doctor` vào danh sách lệnh con chính thức được hiển thị trong `nightowl --help` và hỗ trợ `nightowl doctor --help`.
- `project-setup`: Bổ sung requirement chẩn đoán môi trường và cấu hình dự án (`nightowl doctor`), định nghĩa các tiêu chí kiểm tra hợp lệ, cảnh báo và lỗi cho từng thành phần.

## Impact

- **Mã nguồn lệnh CLI**: Tạo mới `src/commands/doctor.ts`, cập nhật `src/commands/index.ts`.
- **Logic kiểm tra**: Sử dụng lại các helper hiện có trong `src/setup/` (`claude-settings.ts`, `git-hook.ts`, `path.ts`) và `src/storage/` (`store.ts`, `data-dir.ts`).
- **Kiểm thử**: Tạo bộ test `test/commands/doctor.test.ts` kiểm tra các kịch bản môi trường đạt chuẩn, thiếu hook, database lỗi, và cờ `--strict`.
- **Dependencies & Network**: Hoàn toàn cục bộ, zero runtime dependencies, không gọi mạng.
