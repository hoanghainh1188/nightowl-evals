# Tasks

## 1. Cài hook qua init

- [x] 1.1 Viết test cho `installPreCommit` trong repo git tạm: chưa có hook (tạo, quyền 755), có hook `sh` khác (chèn sau shebang, giữ nội dung và quyền), hook không có shebang, hook Node (không sửa, trả hướng dẫn), chạy hai lần không trùng; cài `src/setup/git-hook.ts` để pass
- [x] 1.2 Viết test `core.hooksPath` đặt là `.husky` → không sửa file nào, `init` in hướng dẫn ra stderr, thoát 0; nối vào `src/commands/init.ts` để pass
- [x] 1.3 Viết test commit thật trong repo tạm khi `nightowl` không có trong `PATH` → commit thành công

## 2. nightowl precommit

- [x] 2.1 Viết test cho đọc file staged (`git diff --cached`, `git cat-file --batch`), gồm tên file có dấu cách và ký tự Unicode; cài `src/hooks/git/staged.ts` để pass
- [x] 2.2 Viết test truy vấn sự kiện `edit` chưa kiểm tra (một sự kiện, nhiều sự kiện cùng file, đã được tính bởi `commit-check` trước); cài `listUncheckedEdits` trong `src/storage/events.ts` để pass
- [x] 2.3 Viết test so sánh: `unchanged`, `modified` có đếm dòng, `whitespace_only`, nội dung staged > 512 KB bị bỏ; cài `src/hooks/git/compare.ts` để pass
- [x] 2.4 Viết test cho lệnh `precommit`: chưa có `.nightowl/` (không tạo file), DB hỏng (ghi `nightowl.log`), luôn im lặng và thoát 0, dừng sau 2 giây với 500 file; cài `src/commands/precommit.ts` và đăng ký lệnh để pass
- [x] 2.5 Viết test payload `commit-check` không chứa `user.name`/`user.email` của git

## 3. Kiểm tra đầu cuối

- [x] 3.1 Test e2e trong repo git tạm: `init` → pipe payload `Write` vào `log` → sửa file → `git add` + `git commit` thật → DB có `commit-check` `modified`; lặp lại không sửa → `unchanged`; commit lần hai không tạo `commit-check` trùng
- [x] 3.2 Cập nhật `--help` cho lệnh `precommit` và test tương ứng; chạy `npm run test:coverage` đạt ≥ 80%
- [ ] 3.3 Thử thật trên dự án cá nhân: `nightowl init`, làm việc với Claude Code một buổi, commit, rồi đếm sự kiện `commit-check` `modified` trong DB

## Workflow follow-up

- Archive theo thứ tự: `add-local-storage`, `add-claude-code-hook`, rồi `add-git-hook` (change này thêm requirement vào capability `project-setup` do change 3 tạo).
- Viết README (cài đặt, `nightowl init`, giới hạn khi commit bỏ qua hook) sau khi cả ba change xong.
