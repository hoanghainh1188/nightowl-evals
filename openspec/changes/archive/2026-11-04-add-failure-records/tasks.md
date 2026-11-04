# Tasks

## 1. Schema v2

- [x] 1.1 Viết test migration v1 → v2 (cột `prompt_event_id`, bảng `checks_attached`, dữ liệu v1 giữ nguyên, mở lại không đổi gì); thêm migration để pass
- [x] 1.2 Viết test cho các hàm lưu trữ: chèn `failures` kèm `checks_attached` trong một transaction, liệt kê `commit-check` chưa xử lý theo file, tìm prompt theo phiên, đếm `failures` theo trạng thái; cài để pass

## 2. Cài hook post-commit

- [x] 2.1 Viết test cho `installGitHook` với `post-commit` (tạo mới, chèn vào hook có sẵn, symlink, `core.hooksPath`, chạy lại không trùng) và giữ nguyên các test `pre-commit`; tổng quát hoá `src/setup/git-hook.ts` để pass
- [x] 2.2 Viết test `init` báo riêng kết quả từng hook và chạy lại trên repo đã cài từ tuần 1 chỉ thêm `post-commit`; nối vào `src/commands/init.ts` để pass

## 3. nightowl postcommit

- [x] 3.1 Viết test đọc blob trong `HEAD` bằng một tiến trình `git cat-file --batch-check` (file có, file không có, tên có dấu cách/Unicode); cài để pass
- [x] 3.2 Viết test dựng bản ghi: `modified` khớp blob → tạo `failures` đủ trường; `unchanged` và `whitespace_only` → không tạo; blob không khớp → để nguyên; `commit-check` cũ hơn → `superseded`; chạy hai lần không nhân đôi; cài `src/hooks/git/attach-commit.ts` để pass
- [x] 3.3 Viết test gắn prompt (cùng phiên, phiên khác, không có prompt); cài để pass
- [x] 3.4 Viết test lệnh `postcommit`: chưa có `.nightowl/`, DB hỏng (ghi log), luôn im lặng thoát 0, hết ngân sách thời gian; thêm vào `HOOK_COMMANDS` và đăng ký lệnh để pass

## 4. nightowl failures

- [x] 4.1 Viết test cho `nightowl failures` (0 lỗi, nhiều trạng thái, ngoài repo → mã 1); cài `src/commands/failures.ts` để pass

## 5. Kiểm tra đầu cuối

- [x] 5.1 Test e2e với git thật: `init` → `log` payload Write → dev sửa → `git commit` → có 1 `failures` với `commit_sha` đúng; commit bị huỷ (hook `commit-msg` fail) → không có `failures`; dev giữ nguyên → không có `failures`
- [x] 5.2 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
- [ ] 5.3 Thử thật trên dự án cá nhân: chạy lại `nightowl init`, làm việc một buổi với Claude Code, rồi `nightowl failures`

## Workflow follow-up

- Archive trước `add-llm-classify` (change 6 dùng schema v2).
