# Tasks

## 1. Formatter / template

- [x] 1.1 Thêm module format customer (Markdown VI / JA / both) từ `Report`; verify unit test snapshot hoặc assert heading + chỉ số chính
- [x] 1.2 Thêm renderer HTML self-contained + escape; verify unit test chứa markup an toàn với label đặc biệt
- [x] 1.3 Fixture có author/email → assert output không chứa chuỗi đó; verify test privacy

## 2. Lệnh customer-report

- [x] 2.1 Implement `customer-report`: parse `--lang`, `--format`, `--since`, `--depth`, `--agent`, `--output`; `buildReport` + openExistingStore; verify command test happy path Markdown
- [x] 2.2 Lỗi: chưa init / since sai / format|lang không hợp lệ / từ chối `--fail-on-rate`; verify exit 1 + stderr
- [x] 2.3 `--output` ghi file, tạo thư mục cha, không dump full report ra stdout; verify command test

## 3. CLI, completion, docs

- [x] 3.1 Đăng ký lệnh + help; catalog completion flags; verify `nightowl --help` / completion có `customer-report` và `--lang`/`--format`
- [x] 3.2 README: ví dụ xuất VI–JA / HTML / `-o`; nêu khác `report` (không CI gate); verify đoạn doc khớp flag thật
- [x] 3.3 `npm test` + typecheck + `openspec validate add-customer-quality-report` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick roadmap #28 Done trong `openspec/project.md` / `docs/v0.4-roadmap-ideas.md`.
