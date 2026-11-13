# Proposal

## Why

`nightowl prune` đã dọn snapshot theo `--days` / `--dry-run` / `--vacuum`, nhưng dry-run chỉ báo **số hàng**, không ước lượng **bytes**, không có **retention profile** đặt tên, và sau vacuum không tóm tắt dung lượng DB trước/sau. Team local khó quyết định prune an toàn trên máy/CI.

## What Changes

- Dry-run (và output prune thật) SHALL báo số snapshot **và** ước lượng bytes snapshot sẽ bỏ (tổng độ dài chuỗi snapshot trong payload trước khi null).
- Thêm retention **profile** đặt tên (map sang số ngày đã document, ví dụ `short` / `default` / `long`); tương thích với `--days` (một trong hai hoặc `--days` thắng khi cả hai — ghi rõ trong design).
- Khi `--vacuum` (sau prune thật), SHALL tóm tắt dung lượng file DB trước/sau (bytes; có thể kèm delta). Dry-run SHALL NOT chạy VACUUM.
- Cập nhật `prune --help`, README, completion flags nếu thêm cờ mới.
- **Không** xóa hàng `events`/`failures`; **không** network; **không** đổi semantics mặc định `--days 30` khi không truyền profile.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `local-storage`: ước lượng bytes; retention profile; tóm tắt dung lượng sau vacuum
- `cli`: help/flags `prune` cho profile + output dung lượng
- `shell-completion`: gợi ý flag/profile mới trên `prune` (nếu thêm)

## Impact

- `src/storage/prune.ts`, `src/commands/prune.ts`, có thể `src/completion/catalog.ts`; tests `test/storage/prune.test.ts`, `test/commands/prune.test.ts`.
- Docs README / help. Local-only; macOS/Linux/Windows (đường dẫn `.nightowl/nightowl.db`, `fs.stat`).
