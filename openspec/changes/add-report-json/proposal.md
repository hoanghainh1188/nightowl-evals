# Đề xuất: Nâng cấp Báo cáo Machine-Readable & Quality Gate cho CI/CD và Review

## Bối cảnh & Lý do

Trong môi trường sản xuất và các pipeline CI/CD, NightOwl cần cung cấp khả năng tích hợp máy đọc (machine-readable) toàn diện và thiết lập các cổng kiểm soát chất lượng (Quality Gates) tự động:
1. `nightowl report` hiện đã hỗ trợ cờ `--json` để in JSON ra stdout, nhưng:
   - Thiếu tùy chọn `--output <file>` (`-o <file>`): Ghi trực tiếp báo cáo (text hoặc JSON) ra file để lưu trữ CI artifact trên các hệ điều hành khác nhau mà không phụ thuộc vào shell redirection.
   - Thiếu cơ chế CI Quality Gate `--fail-on-rate <0-100>`: Cho phép CI pipeline fail (thoát mã 1) nếu tỷ lệ code do AI sinh ra bị nhà phát triển sửa đè vượt quá ngưỡng quy định (ví dụ `--fail-on-rate 30`).
2. `nightowl review` hiện tại chỉ hỗ trợ xuất bảng text terminal và hiển thị chi tiết tương tác:
   - Thiếu cờ `--json` cho danh sách bản ghi lỗi (`nightowl review [options] --json`): Cho phép các script CI/CD hoặc bot PR lấy danh sách lỗi có cấu trúc.
   - Thiếu cờ `--json` cho chi tiết lỗi (`nightowl review show <id> --json`): Cho phép công cụ bên ngoài đọc toàn bộ thông tin chi tiết (prompt, AI patch, dev patch, category, reason) của một lỗi cụ thể.

## Phạm vi thay đổi

1. **Mở rộng `nightowl report`**:
   - Thêm tuỳ chọn `--output <path>` (hoặc `-o <path>`): Ghi nội dung kết quả (text hoặc JSON) vào file đích. Tạo thư mục cha nếu chưa có.
   - Thêm tuỳ chọn `--fail-on-rate <0-100>`: So sánh với tỷ lệ `changedRate.rate` (0.0 đến 1.0). Nếu có dữ liệu kiểm tra và tỷ lệ phần trăm (0-100) vượt quá ngưỡng quy định, in thông báo ra stderr/stdout và thoát mã 1. Nếu chưa có dữ liệu hoặc tỷ lệ <= ngưỡng, thoát mã 0.
2. **Bổ sung `--json` cho `nightowl review`**:
   - `nightowl review [--status ...] [--source ...] [--limit ...] --json`: Xuất mảng JSON chứa danh sách các bản ghi lỗi phù hợp với bộ lọc.
   - `nightowl review show <id> --json`: Xuất đối tượng JSON chứa đầy đủ chi tiết bản ghi lỗi.
3. **Cập nhật trợ giúp & tài liệu**:
   - Bổ sung các tuỳ chọn mới vào `help` của `report` và `review`.
4. **Cập nhật Specs**:
   - Spec `failure-report`: Bổ sung yêu cầu về ghi file `--output` và kiểm tra ngưỡng `--fail-on-rate`.
   - Spec `failure-review`: Bổ sung yêu cầu về xuất dữ liệu có cấu trúc với `--json` cho danh sách và chi tiết lỗi.

## Rủi ro & Tương thích ngược

- Hoàn toàn tương thích ngược với các câu lệnh hiện có.
- Không phát sinh phụ thuộc runtime mới (sử dụng module chuẩn của Node.js: `node:fs/promises`, `node:util`).
