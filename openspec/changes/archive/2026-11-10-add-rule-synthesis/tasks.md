# Tasks

## 1. Query và gom cụm failure

- [x] 1.1 Thêm query/filter failure cho suggest-rules (status, category, agent, since); verify unit test filter
- [x] 1.2 Cluster theo category (+ module/path); ngưỡng `min-count` mặc định 2; verify test gom đúng

## 2. Heuristic Markdown (mặc định offline)

- [x] 2.1 Template rule từ cụm + sanitize secret/truncate snippet; verify không lộ secret
- [x] 2.2 Format stdout Markdown có marker `<!-- nightowl-suggested-rules -->`; verify snapshot/string test

## 3. Lệnh CLI `suggest-rules`

- [x] 3.1 Parse flags (`--since`, `--category`, `--agent`, `--status`, `--output`, `--force`, `--min-count`); verify help + lỗi flag
- [x] 3.2 Wire dry-run: không DB → lỗi rõ; có data → stdout; `--output` ghi file + `--force` an toàn; verify command/e2e nhẹ
- [x] 3.3 Đăng ký lệnh trong `commands/index` + README ví dụ; verify `nightowl --help` có `suggest-rules`

## 4. LLM opt-in

- [x] 4.1 `--yes` + transport cli|api tái dùng classify; không `--yes` không gọi model; verify mock/spy
- [x] 4.2 LLM chỉ diễn đạt từ cụm đã chọn (đã sanitize); fallback heuristic nếu model lỗi; verify test

## 5. Kiểm tra tổng

- [x] 5.1 `npm test` / typecheck / `openspec validate` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick change 19 trong `openspec/project.md` / `docs/v0.3-roadmap-ideas.md` (và change 18 nếu chưa).
