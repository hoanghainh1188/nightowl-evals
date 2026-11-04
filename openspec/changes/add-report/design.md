# Design

## Context

Xem proposal.md. Hành vi: `specs/failure-report`. Dựa trên:
- bảng `failures` (schema v3): `file_path`, `category`, `status`, `created_at` (thời điểm `post-commit` tạo bản ghi);
- bảng `checks_attached` (change 5): mỗi lần kiểm tra lúc commit đã xử lý, kết quả `failure`, `not-a-failure` hoặc `superseded`, gắn với sự kiện `commit-check` có `created_at`.

## Goals / Non-Goals

**Goals:**
- Một lệnh trả lời: AI sai kiểu gì, ở đâu, có đỡ hơn theo thời gian không.
- Số liệu `--json` ổn định để dashboard sau này (repo riêng) đọc lại.

**Non-Goals:**
- Giao diện web, biểu đồ đồ hoạ, báo cáo song ngữ.
- Đo lỗi lặp lại giữa các lần.

## Decisions

### 1. Tổng hợp trong SQL, định dạng trong TypeScript
Ba truy vấn `GROUP BY` (theo loại, theo `file_path`, theo ngày) đọc bảng `failures`, không đọc cột nội dung (`ai_content`, `final_content`). Module và tuần ISO được tính trong TypeScript từ kết quả gộp theo `file_path` và theo ngày, vì SQLite không có hàm tuần ISO và cách tách thư mục theo độ sâu viết bằng SQL khó đọc. Số dòng trả về tối đa bằng số file và số ngày có lỗi, nên vẫn nhỏ.

Hàm thuần `buildReport(rows, options) → Report` tách khỏi phần in, để test không cần database.

### 2. Tỷ lệ bị sửa
`tỷ lệ = failure / (failure + not-a-failure)` trên `checks_attached`, ngày lấy từ `created_at` của sự kiện `commit-check`. `superseded` không tính, vì đó là lần kiểm tra của một bản không bao giờ được commit. Mẫu số bằng 0 thì hiện `n/a` (JSON: `null`).

### 3. Tuần ISO theo UTC
`created_at` lưu dạng ISO UTC. Tuần được tính theo UTC để kết quả giống nhau trên mọi máy và trong test. Lệch vài giờ quanh nửa đêm thứ Hai là chấp nhận được ở MVP.

### 4. Không tạo `.nightowl/`
Kiểm tra `.nightowl/` tồn tại trước khi gọi `openStore`, vì `openStore` tạo thư mục và database khi chưa có. `openStore` vẫn chạy migration nếu database cũ hơn; việc đó không đổi dữ liệu đã ghi.

### 5. Định dạng chữ
```
NightOwl report: 12 failures (3 unclassified, 1 dismissed not counted)
AI edits changed by the developer: 12 of 40 checked at commit (30%)

By category
  logic                  5  █████
  convention             3  ███
  misread-requirement    1  █
  missing-context        0
  unclassified           3  ███

By module (top 10 of 7)
  src/hooks              6  ██████
  ...

By week (last 8)
  2026-W44               4  ████     25%
  2026-W45               8  ████████ 33%
```
Thanh dài tối đa 30 ký tự, tỷ lệ với giá trị lớn nhất trong mục. Chữ tiếng Anh, giống các lệnh khác. Đường dẫn được lọc ký tự điều khiển (`printable`, change 6) trước khi in.

### 6. JSON
```json
{ "generated_at": "...", "since": null, "depth": 2,
  "total": 12, "unclassified": 3, "dismissed": 1,
  "changed_rate": { "failures": 12, "checked": 40, "rate": 0.3 },
  "by_category": { "logic": 5, "convention": 3, "misread-requirement": 1, "missing-context": 0, "unclassified": 3 },
  "by_module": [ { "module": "src/hooks", "failures": 6 } ],
  "by_week": [ { "week": "2026-W45", "failures": 8, "checked": 24, "rate": 0.33 } ] }
```
`by_module` sắp theo số lỗi giảm dần rồi theo tên; `by_week` sắp theo thời gian.

## Risks / Trade-offs

- [`created_at` của lỗi là lúc commit, không phải lúc AI viết] → Đủ cho xu hướng theo tuần; ghi rõ trong help của lệnh.
- [Module theo thư mục không khớp module thật của mọi dự án] → `--depth` cho người dùng chỉnh; cấu hình module riêng để sau.
- [Database lớn] → Chỉ đọc cột nhỏ và gộp trong SQL; không tải nội dung code.
