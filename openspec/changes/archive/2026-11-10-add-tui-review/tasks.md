# Tasks

## 1. Parse flag và gate TTY

- [x] 1.1 Parse `-i` / `--interactive` trên `review`; conflict với `--json`; verify help + lỗi flag
- [x] 1.2 Khi `-i` mà không TTY: stderr rõ, không raw mode, exit ≠ 0; verify command test với mock stdin/stdout

## 2. TUI core (keys + render)

- [x] 2.1 Module keys: map ↑/↓ (và j/k), Space/Enter, c/d/r, q, Ctrl+C; verify unit test
- [x] 2.2 Render list + header hints + diff màu ANSI (sanitize); verify snapshot/string test không lộ ESC từ nội dung DB

## 3. Session + wire store

- [x] 3.1 Session: load list theo filter, điều hướng, toggle diff, mark + refresh list; verify unit/integration với store giả hoặc fake repo
- [x] 3.2 Wire `review.ts` + deps injectable; phục hồi raw mode trong `finally`; verify thoát `q` / Ctrl+C

## 4. Docs và kiểm tra tổng

- [x] 4.1 README + `review --help` nêu phím tắt; verify chuỗi help
- [x] 4.2 `npm test` / typecheck / `openspec validate` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick change 21 trong `openspec/project.md` / `docs/v0.3-roadmap-ideas.md`.
