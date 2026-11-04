# Tasks

## 1. Hook Claude Code

- [x] 1.1 Viết test cho nhận diện hook NightOwl (dạng cũ `nightowl log` và dạng mới), cho `mergeClaudeHooks` thêm dạng mới và nâng cấp dạng cũ tại chỗ (giữ matcher, timeout, vị trí); cài trong `src/setup/claude-settings.ts` để pass
- [x] 1.2 Viết test chạy lệnh hook dạng mới bằng `sh -c` với `PATH` không có `nightowl`: thoát 0, không in gì
- [x] 1.3 Viết test cho `removeClaudeHooks`: bỏ hook NightOwl, bỏ nhóm/event/`hooks` rỗng, giữ mọi thứ khác, báo khi kết quả là `{}`; cài để pass

## 2. Chọn file và git

- [x] 2.1 Viết test cho kiểm tra file đã bị git bỏ qua (`check-ignore`: 0, 1, lỗi khác) và đã bị theo dõi (`ls-files`); cài trong `src/setup/claude-install.ts` để pass
- [x] 2.2 Viết test cho chọn file đích: mặc định cá nhân, `--shared`, hook đã ở file kia (không ghi, có hướng dẫn chuyển), hook ở cả hai (cảnh báo); cài để pass

## 3. nightowl init

- [x] 3.1 Viết test lệnh: `--shared`, tuỳ chọn lạ, file cá nhân đã được commit (thoát 1, không ghi), `.gitignore` có thêm dòng khi cần, chạy hai lần không đổi gì; đổi `init.ts` sang `parseArgs` và cập nhật trợ giúp để pass

## 4. nightowl uninstall

- [x] 4.1 Viết test cho `removeHookLine`: bỏ dòng có `# nightowl-evals`, báo xoá file khi chỉ còn shebang, giữ phần khác; cài trong `src/setup/git-hook.ts` để pass
- [x] 4.2 Viết test lệnh: gỡ sau khi cài mặc định và `--shared`, giữ cấu hình người dùng, chưa cài, `core.hooksPath`, symlink, tham số lạ, `.nightowl/` và `.gitignore` không đổi; cài `src/commands/uninstall.ts` và đăng ký lệnh để pass

## 5. Kiểm tra đầu cuối

- [x] 5.1 Test e2e với bin thật trong repo git tạm: `init`, sự kiện được ghi qua hook trong `settings.local.json`, `git status` sạch phần `.claude/`; `uninstall` gỡ sạch
- [x] 5.2 Cập nhật README: mặc định cá nhân, `--shared`, `uninstall`
- [x] 5.3 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
