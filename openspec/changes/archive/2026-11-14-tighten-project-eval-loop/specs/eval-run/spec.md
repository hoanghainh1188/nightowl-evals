## ADDED Requirements

### Requirement: Eval gợi ý compare/digest sau khi chạy
Khi `nightowl eval --yes` hoàn tất và đã ghi run vào `.nightowl/runs/` (hoặc path đã document), stderr SHALL gồm gợi ý bước tiếp: `eval-compare` (khi người dùng có/muốn baseline) và/hoặc `digest` / `dashboard` để xem tóm tắt vòng. Dry-run không `--yes` SHALL NOT bắt buộc in cùng hint ghi-run. SHALL NOT gọi mạng thêm vì hint.

#### Scenario: Eval --yes xong có Next
- **WHEN** `eval --yes` chạy xong và ghi run thành công
- **THEN** stderr đề cập `eval-compare` hoặc `digest` / `dashboard`

### Requirement: Help nhấn label trong vòng
`nightowl eval --help` SHALL nêu `--label` dùng để gắn thí nghiệm trong vòng project-eval-loop (suite → eval → digest/dashboard).

#### Scenario: eval --help có label và vòng
- **WHEN** chạy `nightowl eval --help`
- **THEN** stdout đề cập `--label` và liên hệ digest/dashboard hoặc vòng eval
