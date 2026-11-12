# Tasks

## 1. Fingerprint + shared cluster core

- [x] 1.1 Unit tests: fingerprint deterministic (cùng input → cùng hex); secret redact không lộ plaintext trong fingerprint; normalize khác biệt whitespace không đổi key khi design yêu cầu
- [x] 1.2 Module shared `fingerprint` + `clusterKey` + `groupFailures` (category/module/agent/fingerprint, minCount, depth, limit)
- [x] 1.3 Refactor `suggest-rules` / `src/rules/cluster.ts` gọi shared API; verify test rules cluster với fingerprint (hai failure cùng fingerprint → một cluster)

## 2. Report + dashboard surfaces

- [x] 2.1 Failing/integration tests: `report` text + `--json` có top clusters khi ≥2 failure cùng nhóm; dismissed không đếm vào cluster như total
- [x] 2.2 Wire `buildReport` / formatters với clusters từ failures đã filter
- [x] 2.3 `dashboard` HTML section top clusters; verify test HTML; README mô tả clustering ngắn

## 3. Review filter + validate

- [x] 3.1 Tests: `review` list JSON có `cluster_key`; `--cluster <key>` chỉ trả failure thuộc key
- [x] 3.2 Wire review list/filter (CLI parseArgs + queries); help cập nhật
- [x] 3.3 `npm test` + typecheck + `openspec validate add-failure-clustering` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick ideation #35 Done trong `docs/v0.5-roadmap-ideas.md`.
