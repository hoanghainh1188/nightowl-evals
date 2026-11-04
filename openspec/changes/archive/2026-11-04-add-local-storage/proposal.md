# Proposal

## Why

Change 3 (hook Claude Code) và 4 (git hook) đều cần chỗ lưu sự kiện, còn change 5 cần chỗ lưu bản ghi lỗi. Doc đã chốt dùng `node:sqlite`, lưu file trong dự án đích, không phụ thuộc gì bên ngoài. Change này dựng lớp lưu trữ đó trước để hai change hook chỉ cần gọi vào.

## What Changes

- Mở (và tạo nếu chưa có) database SQLite tại `<gốc dự án>/.nightowl/nightowl.db`. Gốc dự án là thư mục chứa `.git` gần nhất tính từ thư mục làm việc.
- Schema v1 gồm hai bảng:
  - `events`: mọi sự kiện thu được (prompt, lần AI sửa file, kết quả kiểm tra lúc commit).
  - `failures`: bản ghi lỗi (AI viết gì, dev sửa thành gì). Change 5 mới ghi vào bảng này; change này chỉ tạo bảng.
- Migration theo số phiên bản (`PRAGMA user_version`), chạy tự động khi mở DB, an toàn khi chạy nhiều lần.
- Chặn `ExperimentalWarning` của `node:sqlite` để lệnh `log` vẫn im lặng (Node 22 và 24 đều in cảnh báo này ra stderr).
- Chịu được nhiều tiến trình ghi cùng lúc (hook Claude Code và git hook có thể chạy song song).

Ngoài phạm vi: lệnh nào ghi gì vào DB (change 3, 4, 5), xoá dữ liệu cũ, mã hoá DB.

## Capabilities

### New Capabilities

- `local-storage`: Nơi lưu dữ liệu local của NightOwl: vị trí file, schema, migration, quyền truy cập đồng thời, và cam kết không rời khỏi máy.

### Modified Capabilities

(không có)

## Impact

- Code mới: `src/storage/` (mở DB, migration, kiểu dữ liệu, ghi và đọc `events`).
- Không thêm dependency. Dùng `node:sqlite` có sẵn từ Node 22.13.
- Chưa có lệnh nào dùng tới. Change 3 là change đầu tiên ghi vào DB.
