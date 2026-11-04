# Tasks

## 1. Lưu trữ

- [x] 1.1 Viết test cho truy vấn danh sách (lọc trạng thái, nguồn, giới hạn, mới nhất trước) và chi tiết (kèm prompt, prompt phản hồi); cài trong `src/storage/failures.ts` để pass
- [x] 1.2 Viết test cho `setFailureStatus`: đổi nhiều id, id trùng, id không có (không đổi gì, trả các id thiếu), id đã ở trạng thái đó; cài để pass

## 2. Định dạng

- [x] 2.1 Viết test cho dòng danh sách (cắt prompt, số dòng thêm và bỏ, lọc ký tự điều khiển) và cho bản chi tiết (diff, giới hạn 200 dòng, diff quá khác, giữ tab, bỏ mã escape); cài trong `src/review/` để pass

## 3. nightowl review

- [x] 3.1 Viết test đọc tham số: lệnh con, id dạng `12` và `#12`, id không hợp lệ, tuỳ chọn lạ, lệnh con lạ, trợ giúp; cài `src/commands/review.ts` để pass
- [x] 3.2 Viết test lệnh: list, show, confirm, dismiss, reset, id thiếu (không đổi gì, thoát 1), repo chưa cài (không tạo gì), ngoài repo; đăng ký lệnh để pass

## 4. Report

- [x] 4.1 Viết test cho đếm theo trạng thái (chữ và `by_status` JSON); cài để pass

## 5. Kiểm tra đầu cuối

- [x] 5.1 Test e2e với bin thật: tạo lỗi qua commit thật, `review`, `review show`, `review dismiss`, rồi `report` và `export` không còn lỗi đó; `review reset` đưa nó trở lại
- [x] 5.2 Cập nhật README
- [x] 5.3 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
