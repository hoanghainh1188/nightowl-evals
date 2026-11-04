# Tasks

## 1. Truy vấn

- [x] 1.1 Viết test cho các truy vấn đọc: đếm lỗi theo loại, theo `file_path`, theo ngày (bỏ `dismissed`, lọc `--since`), đếm kết quả `checks_attached` theo ngày (bỏ `superseded`); không đọc cột nội dung; cài trong `src/storage/` để pass

## 2. Tổng hợp

- [x] 2.1 Viết test cho tuần ISO theo UTC (đầu năm, cuối năm, tuần 53) và cho module theo độ sâu (gốc dự án, file nông hơn độ sâu); cài để pass
- [x] 2.2 Viết test cho `buildReport`: tổng, chưa phân loại, bị loại, tỷ lệ (cả mẫu số 0), sắp xếp module và tuần; cài `src/report/build.ts` để pass

## 3. In báo cáo

- [x] 3.1 Viết test cho bản chữ: thanh đếm, top 10 module, 8 tuần gần nhất, `n/a`, chưa có lỗi, lọc ký tự điều khiển; cài `src/report/format.ts` để pass
- [x] 3.2 Viết test cho bản `--json`: đúng schema ở design mục 6, đủ module và tuần; cài để pass

## 4. nightowl report

- [x] 4.1 Viết test lệnh: tuỳ chọn hợp lệ và không hợp lệ (`--since`, `--depth`, tuỳ chọn lạ), chưa có `.nightowl/` (không tạo gì, thoát 1), ngoài repo (thoát 1), database không đổi sau khi chạy; thay lệnh rỗng bằng `src/commands/report.ts` để pass

## 5. Kiểm tra đầu cuối

- [x] 5.1 Test e2e với git thật: `init`, dựng 2 lỗi qua commit thật, `nightowl report` và `nightowl report --json`
- [x] 5.2 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
