# Spec Delta: local-storage

## ADDED Requirements

### Requirement: Dọn dẹp dữ liệu lưu trữ
`nightowl prune` SHALL hỗ trợ dọn dẹp các snapshot của sự kiện cũ hơn `--days <N>` ngày (mặc định 30 ngày). Với mỗi sự kiện cũ hơn ngưỡng, lệnh SHALL đặt trường `snapshot` trong payload thành `null` và đánh dấu `snapshot_skipped: 'pruned'`. Với `--dry-run`, lệnh chỉ đếm và báo cáo số lượng sự kiện/snapshot sẽ dọn dẹp mà không sửa database. Với `--vacuum`, lệnh SHALL chạy `VACUUM` để thu hồi dung lượng đĩa. Các bản ghi lỗi `failures` SHALL luôn được bảo toàn.

#### Scenario: Dọn dẹp mặc định 30 ngày
- **WHEN** chạy `nightowl prune` trong dự án có các sự kiện cũ hơn 30 ngày kèm snapshot
- **THEN** các sự kiện đó được cập nhật bỏ snapshot, stdout báo số snapshot đã dọn dẹp, và các bản ghi failures giữ nguyên

#### Scenario: Tuỳ chọn số ngày
- **WHEN** chạy `nightowl prune --days 7`
- **THEN** chỉ các sự kiện cũ hơn 7 ngày bị dọn dẹp snapshot

#### Scenario: Chế độ dry-run
- **WHEN** chạy `nightowl prune --dry-run`
- **THEN** stdout báo số lượng snapshot sẽ dọn dẹp, database không thay đổi, mã thoát là 0

#### Scenario: Tuỳ chọn vacuum
- **WHEN** chạy `nightowl prune --vacuum`
- **THEN** lệnh dọn dẹp snapshot và thực thi VACUUM thành công để thu hồi dung lượng đĩa

#### Scenario: Tham số không hợp lệ
- **WHEN** chạy `nightowl prune --days abc` hoặc `nightowl prune --days 0`
- **THEN** lệnh báo lỗi ra stderr và thoát mã 1
