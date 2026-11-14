# Tasks

## 1. Worktree module (TDD)

- [x] 1.1 Tests cho `resolveBaseCommit` / `openCaseWorktree` / `cleanStaleWorktrees` với repo git thật (parent đúng, root commit → null, sha lạ → null, dispose gỡ worktree, dọn worktree sót); verify fail trước khi implement
- [x] 1.2 Implement `src/eval/worktree.ts`; verify tests pass

## 2. Cases + command (TDD)

- [x] 2.1 Tests: `parseCases` đọc `commit_sha` hợp lệ / bỏ qua giá trị lạ
- [x] 2.2 Tests lệnh: mặc định worktree (cwd = worktree, file root không đổi), không có commit → tests_error + require-tests pass false, setup chạy một lần mỗi bài, setup fail, `--isolation in-place` giữ hành vi cũ, validate flag, dry-run nêu isolation
- [x] 2.3 Implement wiring trong `src/commands/eval.ts`; verify tests pass

## 3. Docs + completion

- [x] 3.1 Completion catalog thêm `--isolation`, `--setup-command`; help + README
- [x] 3.2 E2E: eval-flow với `--test-command` chạy trong worktree tại parent commit
- [x] 3.3 `tsc`, full `npm run test:coverage`, `openspec validate run-eval-tests-in-worktree --strict`
