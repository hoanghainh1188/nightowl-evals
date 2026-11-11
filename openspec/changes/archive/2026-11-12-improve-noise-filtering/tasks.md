# Tasks

## 1. Schema + scoring core

- [x] 1.1 Migration: `failures.noise_score`, `failures.noise_reasons`, bảng `noise_stats`; verify test mở DB cũ → cột mới + failures cũ còn
- [x] 1.2 Module `scoreNoise(ai, final, stats)` với unit tests: comment-only, thay đổi logic thường, format-only (score/reasons đúng)
- [x] 1.3 Quy tắc safe auto-noise (ít nhất `comment-only` → dismissed + `auto-noise`); verify unit test quyết định status

## 2. Wire attach + review learning

- [x] 2.1 Failing/integration tests: post-commit comment-only không tăng `report.total`; failure thường vẫn flagged kèm score
- [x] 2.2 Gắn scoring vào tạo failure trong attach/post-commit path; verify tests 2.1 xanh
- [x] 2.3 `review dismiss|confirm|reset` cập nhật `noise_stats`; verify test đếm tăng/giảm và learned ảnh hưởng score

## 3. Report, dashboard, docs

- [x] 3.1 `report` text + `--json` có `noise` (review_rate null khi thiếu mẫu, auto_noise count); verify command tests
- [x] 3.2 `dashboard` HTML có section noise; verify test HTML
- [x] 3.3 README mô tả noise filtering / safe auto-noise; `npm test` + typecheck + `openspec validate improve-noise-filtering` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick ideation #34 Done trong `docs/v0.5-roadmap-ideas.md`.
