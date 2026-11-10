# Tasks

## 1. Composite Action skeleton

- [x] 1.1 Tạo `action/action.yml` (composite): inputs `fail-on-rate`, `since`, `output-path`, `working-directory`, `nightowl-version`, `comment-on-pr`, `github-token`; steps setup-node (pin SHA), npm install package, preflight DB; verify file parse được (test YAML hoặc `action.yml` tồn tại đủ keys)
- [x] 1.2 Step chạy `nightowl report` với `--fail-on-rate` / `--output` / `--since` (khi set) trong `working-directory`, propagate exit code; verify script/dry logic với mock hoặc checklist đối chiếu `action.yml`

## 2. Sticky PR comment

- [x] 2.1 Script format markdown “AI Coding Health Report” từ JSON report + marker sticky; verify unit test fixture JSON → markdown chứa rate/totals/marker
- [x] 2.2 Step comment: tìm/cập nhật sticky qua `gh`/`curl` khi `comment-on-pr` và có PR; warn-only nếu API fail; verify nhánh tắt comment không gọi API (test script flag hoặc conditional trong `action.yml`)

## 3. Docs và kiểm tra tổng

- [x] 3.1 Cập nhật README mục CI/CD: ví dụ `uses: .../action@...`, inputs, permissions, cảnh báo restore `.nightowl/`; verify chuỗi/docs khớp `action.yml`
- [x] 3.2 `npm test` / typecheck / `openspec validate` (change) xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick change 22 trong `openspec/project.md` / `docs/v0.3-roadmap-ideas.md`.
