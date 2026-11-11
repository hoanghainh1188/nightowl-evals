# Tasks

## 1. HTML formatter + opener helper

- [x] 1.1 Thêm `formatDashboardHtml(report)` (self-contained, escape HTML) với unit test: có dữ liệu thì chứa total/category/module/agent/week; không `http://`/`https://` CDN
- [x] 1.2 Fixture failure gắn author/email → assert HTML không chứa chuỗi đó; verify privacy unit test
- [x] 1.3 Thêm helper `openLocalPath(path, platform)` injectable; unit test chọn lệnh đúng cho darwin/win32/linux và không mở TCP server

## 2. Lệnh dashboard

- [x] 2.1 Viết failing command tests trước: happy path ghi `.nightowl/dashboard.html`, `--output`, `--since`/`--agent`/`--depth`, từ chối `--fail-on-rate`, chưa init → exit 1
- [x] 2.2 Implement `dashboard`: `openExistingStore` + `buildReport` (+ signal counts như report/customer-report), default output `.nightowl/dashboard.html`, stdout in path; verify tests 2.1 xanh
- [x] 2.3 `--open` gọi opener sau khi ghi; opener fail → stderr + exit ≠ 0; verify với opener mock

## 3. CLI, completion, docs

- [x] 3.1 Đăng ký lệnh + help; catalog completion (`--since`, `--depth`, `--agent`, `--output`, `-o`, `--open`); verify `nightowl --help` / completion có `dashboard` và `--open`
- [x] 3.2 README: ví dụ `dashboard` / `--open` / `-o`; nhấn local-only ≠ SaaS team dashboard; verify đoạn doc khớp flag thật
- [x] 3.3 `npm test` + typecheck + `openspec validate add-local-dashboard` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick ideation #32 Done trong `docs/v0.5-roadmap-ideas.md`.
