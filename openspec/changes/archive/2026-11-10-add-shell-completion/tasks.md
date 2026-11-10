# Tasks

## 1. Catalog và lệnh completion

- [x] 1.1 Module catalog: danh sách lệnh từ registry + bảng flag tĩnh; verify test mọi command có entry flags
- [x] 1.2 Lệnh `completion <bash|zsh|fish>`: parse shell, help, lỗi shell lạ; đăng ký index; verify command/help tests

## 2. Generators Bash / Zsh / Fish

- [x] 2.1 Render Bash + Zsh + Fish từ catalog; verify stdout chứa tên lệnh và flag then chốt (`--format`, `--fail-on-rate`, …)
- [x] 2.2 Wire `completion` gọi renderer đúng shell; verify mỗi shell thoát 0

## 3. Docs và kiểm tra tổng

- [x] 3.1 README: cách `eval`/`source` cho 3 shell; verify chuỗi docs
- [x] 3.2 `npm test` / typecheck / `openspec validate` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick change 24 trong `openspec/project.md` / `docs/v0.3-roadmap-ideas.md`.
