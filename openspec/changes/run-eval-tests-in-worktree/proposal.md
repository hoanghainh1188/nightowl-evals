# Proposal

## Why

`nightowl eval --test-command` hiện ghi đầu ra model **đè lên file thật trong working tree** ở project root, chạy test trên **HEAD hiện tại**, rồi khôi phục. Hệ quả:

- **Sai ngữ cảnh**: đầu vào của bài (`input.file_before`) là trạng thái ở *parent của commit lỗi*, nhưng test chạy trên codebase đã tiến hoá; pass/fail của bài cũ không phản ánh model.
- **Không an toàn**: Ctrl-C / crash giữa chừng có thể để lại file đã bị đè trong cây làm việc của developer; đang có thay đổi chưa commit thì test chạy trên trạng thái bẩn.

## What Changes

- Thêm `--isolation worktree|in-place` cho `nightowl eval`; **mặc định `worktree`**.
- Ở chế độ `worktree`, mỗi bài có `commit_sha` được chạy test trong một `git worktree --detach` tạm tại **parent của `commit_sha`** (cùng trạng thái với `file_before`), đặt dưới `.nightowl/worktrees/` (gitignored, private). Đầu ra model được ghi vào worktree; cây làm việc của developer SHALL NOT bị ghi.
- Worktree tạo một lần cho mỗi bài, dùng chung cho các model, rồi gỡ (`git worktree remove --force`, fallback xoá thư mục + `git worktree prune`). Đầu mỗi lần chạy dọn worktree cũ còn sót.
- `--setup-command <cmd>` (tuỳ chọn): chạy một lần trong worktree mới trước khi test (ví dụ `npm ci`). Thất bại → test của bài đó ghi không đạt kèm lý do.
- Bài không có `commit_sha` hoặc không resolve được parent (root commit, commit đã mất): test **không chạy**, `tests_error` nêu lý do, `tests_passed` null; với `--require-tests` thì `pass` false.
- `--isolation in-place` giữ hành vi cũ (ghi/khôi phục ở project root).
- Dry-run, `--help`, README, completion nêu chế độ mới.

**BREAKING (hành vi mặc định):** người dùng `--test-command` trước đây chạy trên HEAD giờ chạy trên parent của commit lỗi; muốn hành vi cũ dùng `--isolation in-place`. Schema `nightowl.eval/v1` và kết quả JSONL không đổi.

**Out of scope:** cài dependency tự động; cache worktree giữa các lần chạy; chạy song song; đổi công thức chấm textual; bất kỳ thứ gì gửi ra ngoài máy.

## Capabilities

### Modified Capabilities

- `eval-run`: lệnh test chạy trong worktree cô lập theo mặc định; thêm `--isolation`, `--setup-command`.
- `shell-completion`: catalog `eval` gồm `--isolation`, `--setup-command`.

## Impact

- Code: `src/eval/worktree.ts` (mới), `src/eval/cases.ts` (đọc `commit_sha`), `src/commands/eval.ts`, `src/completion/catalog.ts`, README, tests.
- Dependencies: không thêm; dùng `git worktree` (git ≥ 2.20 đã là yêu cầu).
- Hard-rule: không exception (local-only; LLM vẫn opt-in qua `--yes`; không chạm hook).
