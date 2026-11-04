# Proposal

## Why

Sau tuần 2 đã có bản ghi lỗi (change 5) và loại lỗi (change 6), nhưng chỉ xem được tổng số qua `nightowl failures`. Doc chốt đầu ra cho người dùng là "lỗi theo loại, theo module", và MVP tuần 3 là "dashboard đơn giản: lỗi theo loại, theo module, theo tuần". Có báo cáo thì mới biết AI hay sai kiểu gì, ở đâu, và xu hướng có giảm không (điều kiện qua giai đoạn 2: tỷ lệ lỗi lặp lại giảm rõ).

## What Changes

- Lệnh `nightowl report` (đang là lệnh rỗng) in báo cáo dạng chữ ra stdout:
  - tổng số lỗi, số chưa phân loại, số bị loại (`dismissed`, không tính);
  - tỷ lệ code AI bị dev sửa: số lần AI sửa bị dev đổi trên tổng số lần đã kiểm tra lúc commit;
  - lỗi theo loại (4 loại + "chưa phân loại"), có thanh đếm bằng ký tự;
  - lỗi theo module (thư mục của file, mặc định 2 cấp, ví dụ `src/hooks`), 10 module nhiều lỗi nhất;
  - lỗi theo tuần (tuần ISO, ví dụ `2026-W45`), kèm tỷ lệ bị sửa của tuần đó, 8 tuần gần nhất.
- Tuỳ chọn:
  - `--json`: in cùng số liệu dạng JSON, đầy đủ (không cắt top 10, không cắt 8 tuần), để làm dashboard sau;
  - `--since <YYYY-MM-DD>`: chỉ tính lỗi và lần kiểm tra từ ngày đó;
  - `--depth <1–5>`: số cấp thư mục dùng làm module, mặc định 2.
- Chỉ đọc. Dự án chưa chạy `nightowl init` (chưa có `.nightowl/`) thì báo lỗi, gợi ý chạy `nightowl init`, thoát 1, không tạo file nào.
- Không gửi gì ra ngoài máy.

Ngoài phạm vi: dashboard HTML hay web (theo mô hình open-core, dashboard cho team nằm ở repo riêng), báo cáo song ngữ Việt – Nhật, gợi ý luật cho CLAUDE.md, đo "lỗi lặp lại" (cần so sánh nội dung giữa các lỗi, để sau).

## Capabilities

### New Capabilities

- `failure-report`: Tổng hợp bản ghi lỗi và kết quả kiểm tra lúc commit thành báo cáo theo loại, module, tuần.

### Modified Capabilities

(không có)

## Impact

- Code: `src/commands/report.ts` (thay lệnh rỗng), thư mục mới `src/report/` (tổng hợp số liệu, in chữ), `src/storage/` (truy vấn đọc cho báo cáo).
- Không đổi schema.
- Không thêm dependency.
