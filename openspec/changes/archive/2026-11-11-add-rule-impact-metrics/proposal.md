# Proposal

## Why

Team đã có `suggest-rules` / `suggest-regressions` / `report`, nhưng chưa chứng minh được rule đã áp vào dự án có làm giảm lỗi lặp (cùng category/module/agent) hay không. Cần vòng kín local, offline: ghi baseline khi đánh dấu rule đã áp dụng, rồi so sánh cửa sổ sau với trước — phục vụ dùng nội bộ và roadmap #27.

## What Changes

- Lệnh tường minh để **đánh dấu rule đã áp dụng** kèm snapshot baseline (thời điểm, filter category/module/agent, số đếm failure hiện có) trong store local.
- Lệnh (hoặc chế độ report) **so sánh impact**: số/tỷ lệ failure trong cửa sổ sau `applied_at` so với cửa sổ trước cùng độ dài (hoặc `--since` tường minh); xuất text + `--json`.
- Không tự đoán từ chỉnh sửa `CLAUDE.md` (đó thuộc #29); không bịa failure; không gọi mạng/LLM.
- Schema lưu bản ghi “rule application” (không mở rộng `failures.source` giả).

## Capabilities

### New Capabilities
- `rule-impact`: Đánh dấu rule đã áp dụng + đo/so sánh metrics lỗi trước/sau trên dữ liệu NightOwl local.

### Modified Capabilities
- `cli`: Đăng ký lệnh impact / mark (tên theo design) và help.
- `local-storage`: Lưu bản ghi áp dụng rule + baseline snapshot; migration schema.
- `shell-completion`: Gợi ý lệnh và flag mới.

## Impact

- CLI: lệnh mới + completion catalog; README ngắn.
- Storage: migration (+1) bảng hoặc events kind chuyên dụng.
- Không đổi hành vi mặc định của `nightowl report` / CI `--fail-on-rate` (impact là lệnh riêng).
- Tests: unit/command cho mark idempotent và so sánh cửa sổ; không e2e mạng.
- Không đụng hook agent/git (không chậm commit).
