# Proposal: Cơ Chế Dọn Dẹp và Tối Ưu Dung Lượng Lưu Trữ (nightowl prune)

## Why

NightOwl lưu trữ các ảnh chụp (snapshot) nội dung mã nguồn (tối đa 512 KB mỗi lần) vào bảng `events` trong file SQLite cục bộ `.nightowl/nightowl.db`. Sau thời gian dài phát triển dự án, lượng snapshot cũ tích lũy có thể làm dung lượng file SQLite tăng lên hàng trăm megabyte. Hiện tại chưa có cơ chế dọn dẹp snapshot cũ hoặc thu hồi dung lượng đĩa thừa (vacuum). Lệnh `nightowl prune` giúp lập trình viên chủ động dọn dẹp các sự kiện/snapshot cũ đã qua xử lý theo ngưỡng thời gian (số ngày) và tối ưu hóa dung lượng lưu trữ cục bộ.

## What Changes

- Bổ sung lệnh con `nightowl prune` với các tuỳ chọn:
  - `--days <N>`: Chỉ định ngưỡng số ngày lưu trữ (mặc định 30 ngày). Các sự kiện cũ hơn N ngày sẽ được dọn dẹp snapshot (`snapshot` chuyển thành `null`, `snapshot_skipped: 'pruned'`) và xóa các sự kiện độc lập không còn tham chiếu.
  - `--dry-run`: Chạy thử nghiệm và báo cáo số lượng sự kiện/snapshot sẽ bị dọn dẹp mà không ghi thay đổi vào database.
  - `--vacuum`: Thực thi lệnh `VACUUM` trên SQLite sau khi dọn dẹp để giải phóng dung lượng đĩa thừa về cho hệ điều hành.
- Bổ sung phương thức `pruneStorage(options)` trong tầng lưu trữ `src/storage/store.ts` để thực hiện thao tác an toàn trong transaction.
- Báo cáo rõ ràng ra stdout số sự kiện đã dọn dẹp, số snapshot đã lược bỏ, và trạng thái giải phóng dung lượng đĩa.

## Capabilities

### Modified Capabilities
- `cli`: Bổ sung `prune` vào danh sách lệnh con chính thức trong `nightowl --help` và hỗ trợ `nightowl prune --help`.
- `local-storage`: Bổ sung requirement về dọn dẹp dữ liệu lưu trữ (`nightowl prune`), định nghĩa hành vi dọn dẹp theo thời gian, cờ `--dry-run`, giải phóng dung lượng (`--vacuum`) và bảo toàn các bản ghi lỗi (`failures`).

## Impact

- **CLI Commands**: Tạo mới `src/commands/prune.ts`, đăng ký vào `src/commands/index.ts`.
- **Storage Layer**: Bổ sung hàm truy vấn dọn dẹp trong `src/storage/prune.ts` và export qua `src/storage/store.ts`.
- **Kiểm thử**: Viết unit test cho `prune` trong `test/commands/prune.test.ts` và `test/storage/prune.test.ts`.
- **Zero Network & Safety**: Hoàn toàn cục bộ, bảo vệ toàn vẹn các bản ghi lỗi (`failures`) hiện có.
