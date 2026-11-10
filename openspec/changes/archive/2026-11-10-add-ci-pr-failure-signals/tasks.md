# Tasks

## 1. Schema và mô hình sự kiện

- [x] 1.1 Migration: hỗ trợ source/kind CI–PR + `dedupe_key` (nếu cần); verify test migration từ DB cũ
- [x] 1.2 API store ghi/đọc/list sự kiện CI/PR theo since + dedupe; verify unit test idempotent

## 2. Ingest CI (file-first)

- [x] 2.1 Parser JUnit (+ JSON summary tối thiểu); verify fixture → normalized records
- [x] 2.2 Lệnh `ingest-ci --file`; liên kết agent best-effort; không tạo failure giả; verify command test + chưa init → lỗi

## 3. Ingest PR

- [x] 3.1 Parser file JSON comment local + lệnh `ingest-pr --file`; verify không mạng
- [x] 3.2 Opt-in `--github` + token: fetch comments; thiếu token → lỗi; verify mock HTTP / không gọi khi tắt

## 4. Report, CLI, completion

- [x] 4.1 `report` text + `--json` đếm `ci_fail` / `pr_review`; verify unit/e2e nhẹ
- [x] 4.2 Đăng ký lệnh + help; cập nhật completion catalog; verify help/`completion` có tên lệnh

## 5. Action và docs

- [x] 5.1 Input Action `junit-path` (optional) chạy ingest trước report; verify action.yml + README ví dụ
- [x] 5.2 README: schema file, giới hạn không bịa ai_content, opt-in GitHub; verify

## 6. Kiểm tra tích hợp

- [x] 6.1 `npm test` / typecheck / `openspec validate add-ci-pr-failure-signals` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick roadmap #26 Done trong `openspec/project.md` / `docs/v0.4-roadmap-ideas.md`.
