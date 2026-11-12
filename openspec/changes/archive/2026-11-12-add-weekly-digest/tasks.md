# Tasks

## 1. Build + format core

- [x] 1.1 Unit tests: parse `--since` YYYY-MM-DD và `Nd`; default 7 ngày; reject invalid
- [x] 1.2 Module `buildDigest` từ store (totals, top category/agent, flagged, signals, rule-impact summary hoặc none)
- [x] 1.3 Formatters Markdown + HTML self-contained (escape; không CDN); tests snapshot/contains

## 2. CLI surface

- [x] 2.1 Lệnh `nightowl digest` (`--since`, `--format`, `--output`, `--depth`, `--agent`); verify chưa init / chỉ đọc DB
- [x] 2.2 Đăng ký `commands/index` + help; completion catalog; test help chứa `digest`
- [x] 2.3 README mô tả digest + không gửi email/Slack

## 3. Validate

- [x] 3.1 Integration: seed failures + flagged → digest md có totals/flagged; html ghi file; lần 2 không đổi DB
- [x] 3.2 `npm test` + typecheck + `openspec validate add-weekly-digest` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick ideation #36 Done trong `docs/v0.5-roadmap-ideas.md`.
