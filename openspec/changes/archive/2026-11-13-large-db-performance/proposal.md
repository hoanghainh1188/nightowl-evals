# Proposal

## Why

Store dùng lâu làm `report` / `dashboard` chậm trên laptop: bảng `failures` gần như **không có index** theo `created_at`/`agent`, trong khi report luôn lọc theo cửa sổ thời gian. Cần index an toàn + cách **đo** thời gian query (doctor hoặc flag debug) mà **không đổi semantics** báo cáo.

## What Changes

- Migration schema thêm index phục vụ cửa sổ report (ít nhất `failures(created_at)`; thêm composite với `agent` nếu hữu ích; xem xét `checked_edits(check_id)` cho join path).
- `nightowl doctor` SHALL đo thời gian một (các) query report-read mẫu và cảnh báo khi vượt ngân sách đã document (warn, không fail trừ `--strict` nếu design chọn).
- Tuỳ chọn debug timing trên `report` (ví dụ `--debug-timing`) in ms các bước đọc chính ra stderr — opt-in, mặc định tắt.
- **Không** đổi số liệu/JSON report; **không** network; **không** background vacuum bắt buộc.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `local-storage`: index / migration cho query report lớn
- `project-setup`: doctor đo timing / budget query
- `cli`: help doctor + `report --debug-timing` (nếu thêm)
- `failure-report`: (nếu cần) hành vi debug timing không đổi output stdout chính

## Impact

- `src/storage/migrations.ts`, report-queries callers, `doctor.ts`, có thể `report.ts`.
- Tests migration + doctor timing + debug flag. macOS/Linux/Windows.
- README ngắn về perf / doctor warn.
