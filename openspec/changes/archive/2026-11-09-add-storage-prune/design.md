# Design: Cơ Chế Dọn Dẹp và Tối Ưu Dung Lượng Lưu Trữ (nightowl prune)

## Context

Bảng `events` trong `.nightowl/nightowl.db` lưu trữ nội dung code trước khi commit qua trường `payload.snapshot` (kích thước tối đa 512 KB/lần ghi). Sau nhiều tuần làm việc với hàng trăm sự kiện `edit`, dung lượng database có thể phình to hàng trăm megabytes.

## Goals / Non-Goals

**Goals:**
- Cung cấp lệnh `nightowl prune` cho phép dọn dẹp các snapshot của sự kiện cũ hơn một ngưỡng thời gian xác định (`--days <N>`, mặc định 30 ngày).
- Giảm 95-99% dung lượng lưu trữ của các sự kiện cũ bằng cách loại bỏ trường snapshot và đánh dấu `snapshot_skipped: 'pruned'`.
- Hỗ trợ `--dry-run` để người dùng xem trước số lượng sự kiện/snapshot sẽ bị dọn dẹp mà không sửa đổi database.
- Hỗ trợ `--vacuum` để thu hồi không gian đĩa vật lý về hệ điều hành sau khi dọn dẹp.
- Giữ nguyên vẹn toàn bộ bản ghi `failures` và tính toàn vẹn khoá ngoại của cơ sở dữ liệu.

**Non-Goals:**
- Không xóa các dòng bản ghi trong bảng `failures`.
- Không tự động chạy background daemon gây tốn tài nguyên ngoài ý muốn của người dùng.

## Decisions

### Quyết định 1: Lược bỏ Snapshot thay vì Xóa Dòng (Snapshot Stripping vs Row Deletion)
- **Lựa chọn**: Sử dụng hàm SQLite `json_set` để cập nhật `payload`:
  ```sql
  UPDATE events
  SET payload = json_set(payload, '$.snapshot', null, '$.snapshot_skipped', 'pruned')
  WHERE created_at < :cutoff
    AND json_extract(payload, '$.snapshot') IS NOT NULL;
  ```
- **Lý do**:
  - Snapshot chiếm phần lớn dung lượng file database.
  - Giữ lại dòng `events` giúp bảo toàn toàn bộ quan hệ khoá ngoại với bảng `failures` (`ai_event_id`, `prompt_event_id`) và bảng `checked_edits`.
  - Các lệnh phân tích như `nightowl report` vẫn có thể tính toán số lượng sự kiện theo tuần/tháng trong quá khứ mà không bị đứt gãy dữ liệu lịch sử.

### Quyết định 2: Hỗ trợ VACUUM có điều kiện qua cờ `--vacuum`
- **Lựa chọn**: SQLite khi xóa hoặc giảm kích thước dữ liệu sẽ giữ lại các trang trống trong file DB để tái sử dụng. Để thu hồi dung lượng thực sự về hệ điều hành, cần gọi lệnh `VACUUM`. Thao tác này được kích hoạt thông qua tuỳ chọn `--vacuum`.
- **Lý do**: `VACUUM` yêu cầu khoá độc quyền (exclusive lock) và dung lượng đĩa tạm thời bằng kích thước database hiện tại. Để người dùng chủ động kiểm soát là giải pháp an toàn và linh hoạt nhất.

### Quyết định 3: Tham số và Định dạng Đầu ra
- Tuỳ chọn CLI:
  - `--days <N>`: Số nguyên dương `>= 1` (mặc định: `30`).
  - `--dry-run`: Chế độ xem trước, không ghi DB.
  - `--vacuum`: Thu hồi dung lượng đĩa sau khi dọn dẹp.
- Thông báo đầu ra:
  ```
  Pruned 45 snapshots from events older than 30 days (before 2026-10-10T00:00:00.000Z).
  Database vacuum completed.
  ```

## Risks / Trade-offs

- **[Risk]** Lệnh `VACUUM` có thể thất bại nếu đĩa lưu trữ đầy không đủ chỗ tạo file tạm.  
  → **Mitigation**: Thực hiện prune snapshot trong transaction trước và commit. Sau đó thực thi `VACUUM` riêng biệt; nếu `VACUUM` gặp lỗi, thông báo cảnh báo rõ ràng ra stderr mà không làm rollback việc dọn dẹp snapshot đã thành công.
