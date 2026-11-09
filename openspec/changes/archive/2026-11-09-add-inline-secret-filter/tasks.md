# Tasks

## 1. Secret Detection Core

- [x] 1.1 Triển khai hàm `containsInlineSecret` trong `src/hooks/claude-code/sensitive.ts` với các mẫu regex nhận diện private keys, GitHub, Anthropic, OpenAI, AWS, Slack tokens và generic token assignments.
- [x] 1.2 Bổ sung unit tests cho `containsInlineSecret` trong `test/hooks/claude-code/sensitive.test.ts`.

## 2. Enforcement in Hooks & Pipeline

- [x] 2.1 Cập nhật `src/hooks/claude-code/to-event.ts` để chặn lưu snapshot và input khi phát hiện secret inline, đánh dấu `contains_secret`.
- [x] 2.2 Cập nhật `src/hooks/git/check-commit.ts` để chặn lưu `staged_content` khi phát hiện secret inline, đánh dấu `contains_secret`.
- [x] 2.3 Cập nhật `src/commands/export.ts` và `src/eval/cases.ts` để loại bỏ các bản ghi lỗi chứa secret inline khỏi file xuất dataset và pipeline đánh giá.
- [x] 2.4 Bổ sung unit tests cho việc chặn secret inline trong `test/hooks/claude-code/to-event.test.ts`, `test/commands/precommit.test.ts`, `test/commands/export.test.ts` và `test/eval/cases.test.ts`.

## 3. Verification & OpenSpec

- [x] 3.1 Chạy `npm run typecheck` và `npm run build` để đảm bảo không có lỗi kiểu và build thành công.
- [x] 3.2 Chạy `npm run test:coverage` để đảm bảo toàn bộ bộ kiểm thử đều pass và độ bao phủ kiểm thử đạt >= 95%.
- [x] 3.3 Chạy `npm run spec:validate` để xác nhận toàn bộ OpenSpec specs và change proposal đều hợp lệ.

## Workflow follow-up

- Mở Pull Request trên GitHub (`gh pr create`).
- Chờ GitHub Actions CI pass.
- Merge PR vào `main` và archive change.
