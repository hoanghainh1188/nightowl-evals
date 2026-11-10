# Tasks

## 1. Chọn failure và dựng eval case

- [x] 1.1 Query/filter failure cho suggest-regressions (status mặc định `confirmed`, category/agent/since/limit); verify unit test filter
- [x] 1.2 Map sang `nightowl.eval/v1` (tái dùng `toEvalCase` / `file_before` khi có); skip path + inline secret; verify không lộ secret và đếm bản ghi bỏ

## 2. Format khung (JSON + stub)

- [x] 2.1 Format fixture JSON một case/file + marker/schema nhận diện NightOwl; verify snapshot/string test id ổn định
- [x] 2.2 Format stub `vitest`/`jest` (todo/skip an toàn) và default `json`; verify chọn framework + nội dung stub không chứa secret

## 3. Lệnh CLI `suggest-regressions`

- [x] 3.1 Parse flags (`--since`, `--category`, `--agent`, `--status`, `--limit`, `--framework`, `--output`, `--force`, opt-in LLM nếu có); verify help + lỗi flag
- [x] 3.2 Wire dry preview stdout; `--output` ghi atomic + `--force` an toàn; verify command test
- [x] 3.3 Đăng ký `commands/index` + README ví dụ; verify `nightowl --help` có `suggest-regressions`

## 4. LLM opt-in (nhẹ)

- [x] 4.1 Không opt-in thì không gọi model (spy/mock); với opt-in chỉ rewrite title/description từ fixture đã sanitize, fallback template nếu lỗi; verify test

## 5. Kiểm tra tổng

- [x] 5.1 `npm test` / typecheck / `openspec validate` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick change 20 (và 18–19 nếu còn “Dự kiến”) trong `openspec/project.md` / `docs/v0.3-roadmap-ideas.md`.
