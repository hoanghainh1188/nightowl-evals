# Design

## Vị trí worktree

`.nightowl/worktrees/<id>/` (tạo bằng `ensurePrivateDir`, đã gitignored). Đặt trong repo thay vì `os.tmpdir()` vì:

- Node/npm tìm `node_modules` (và `node_modules/.bin` khi `npm run`) theo thư mục cha → worktree dùng được dependency đã cài ở project root mà không cần `npm ci` cho phần lớn dự án JS/TS.
- Dễ tìm và dọn khi tiến trình bị huỷ (đầu run: xoá mọi thư mục con + `git worktree prune`).

Dự án ngôn ngữ khác (venv, vendor) dùng `--setup-command`.

## Base commit

`git rev-parse --verify --quiet <commit_sha>^{commit}` rồi `<commit_sha>^`. Khớp với `file_before` mà export đọc từ parent. `commit_sha` phải là hex 7–64 ký tự; giá trị khác bị bỏ qua (coi như không có).

## Vòng đời

```
for case:
  if testCommand && isolation=worktree:
     ws = openWorktree(root, base)   # lazy, lần đầu cần test
     setup once (nếu có)
  for model: claude → score → withSwappedFile(ws.dir/filePath) → runShell(cwd = ws.dir)
  finally ws.dispose()
```

`openWorktree` là dependency tiêm được (`EvalDeps.openWorktree`) để test lệnh không cần git thật; module `worktree.ts` có test riêng với repo git thật.

## Lỗi

| Tình huống | tests_passed | tests_error |
| --- | --- | --- |
| Không có `commit_sha` / parent không resolve | null | `no base commit for worktree` / `cannot resolve parent of <sha>` |
| `git worktree add` lỗi | false | `worktree: <msg>` |
| Setup thoát ≠ 0 / timeout | false | `setup failed: ...` |

`--require-tests` + tests_passed khác true → `pass` false. Gỡ worktree thất bại chỉ cảnh báo stderr (không làm hỏng kết quả đã trả tiền).

## Cross-platform

`git worktree` chạy như nhau trên macOS/Linux/Windows. Xoá thư mục dùng `rm({ recursive, force, maxRetries })` để chịu khoá file tạm thời trên Windows. Đường dẫn file bài nối bằng `join` và kiểm tra không thoát khỏi worktree.
