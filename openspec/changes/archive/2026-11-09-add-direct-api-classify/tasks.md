# Tasks

## 1. Transport và client API

- [x] 1.1 Thêm `--transport cli|api` vào parse options classify; verify unit test reject giá trị lạ và default `cli`
- [x] 1.2 Implement `runAnthropicApi` (fetch + AbortController + đọc `ANTHROPIC_API_KEY`, không log key); verify unit test với mock fetch (success, 401, timeout, thiếu key)

## 2. Gắn vào classify

- [x] 2.1 Dry-run in transport/host khi `api`; verify không có HTTP khi thiếu `--yes`
- [x] 2.2 Với `--yes --transport api`: dùng client API, parse bằng pipeline hiện có, set classifier `anthropic-api:<model>`; verify integration test fake API ghi category đúng
- [x] 2.3 Map `haiku`/`sonnet` alias sang model id API đã pin (hoặc document bắt buộc id đầy đủ) và verify test alias

## 3. Tài liệu và kiểm tra

- [x] 3.1 Cập nhật help + README (env key, ví dụ lệnh); verify `--help` hiện `--transport`
- [x] 3.2 Chạy `npm test` / typecheck phần classify và verify suite xanh

## Workflow follow-up

- Archive sau khi Harry duyệt và merge.
- Tick P2 `add-direct-api-classify` trong `docs/production-readiness.md` khi archive.
