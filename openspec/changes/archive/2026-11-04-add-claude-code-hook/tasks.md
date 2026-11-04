# Tasks

## 1. nightowl init

- [x] 1.1 Viết test cho cập nhật `.gitignore` (chưa có file, đã có dòng, có dòng khác, file không có xuống dòng cuối); cài `src/setup/gitignore.ts` để pass
- [x] 1.2 Viết test cho gộp `.claude/settings.json` (chưa có file, có `permissions`, có hook `PostToolUse` khác, đã có hook NightOwl, JSON hỏng → không sửa file); cài `src/setup/claude-settings.ts` để pass
- [x] 1.3 Viết test cho lệnh `init` (ngoài repo → mã 1 không tạo file, chạy từ thư mục con, chạy hai lần cho cùng kết quả, cảnh báo khi `nightowl` không có trong `PATH`); nối vào `src/commands/init.ts` để pass

## 2. nightowl log

- [x] 2.1 Thêm payload mẫu vào `test/fixtures/claude-code/` (UserPromptSubmit, PostToolUse cho Edit, Write, MultiEdit, Bash) và viết test cho `parseHookPayload`; cài `src/hooks/claude-code/payload.ts` để pass
- [x] 2.2 Viết test chuyển payload thành sự kiện: prompt, edit kèm ảnh chụp file, tool khác bị bỏ, file ngoài dự án / trong `.git/` / `.nightowl/` / qua symlink bị bỏ, cắt prompt 64 KB, bỏ ảnh chụp > 512 KB; cài `src/hooks/claude-code/to-event.ts` để pass
- [x] 2.3 Viết test log lỗi: payload hỏng trong repo ghi một dòng vào `.nightowl/nightowl.log` không chứa nội dung payload, file > 1 MB thì bị làm rỗng; cài `src/hooks/error-log.ts` để pass
- [x] 2.4 Nối `log` vào `openStore`/`insertEvent`; giữ nguyên các test của change 1 (im lặng, luôn thoát 0, stdin không đóng)

## 3. Kiểm tra đầu cuối

- [x] 3.1 Test e2e: trong repo git tạm, chạy `nightowl init` rồi pipe các payload mẫu vào `node dist/bin.js log`; kiểm tra sự kiện trong DB, stdout/stderr rỗng, payload 1 MB xong trong 1 giây
- [x] 3.2 Cập nhật spec `cli` (bỏ `init` khỏi danh sách chưa triển khai) và test `run`/`help` tương ứng; chạy `npm run test:coverage` đạt ≥ 80%
- [ ] 3.3 Thử thật: `npm link`, chạy `nightowl init` trong một repo thử, nhờ Claude Code sửa một file, kiểm tra có sự kiện `prompt` và `edit` trong `.nightowl/nightowl.db` (đã thử `npm link` + `init` + pipe payload mẫu vào `log` trên repo git thật; còn thiếu bước để Claude Code thật gọi hook)
