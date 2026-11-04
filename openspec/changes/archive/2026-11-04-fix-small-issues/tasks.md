# Tasks

## 1. Không tự khởi tạo

- [x] 1.1 Chuyển `openForWrite` từ `review.ts` sang `existing-store.ts` (`openExistingStoreForWrite`); test: chưa cài, schema cũ, đúng phiên bản; cập nhật `review` để dùng nó
- [x] 1.2 Viết test: `failures` trong repo chưa cài (không tạo gì, thoát 1) và với database cũ; đổi sang `openExistingStore` để pass
- [x] 1.3 Viết test: `classify` và `classify --yes` trong repo chưa cài và với database cũ (không tạo gì, không gọi `claude`); đổi sang `openExistingStoreForWrite` để pass

## 2. Khoá phân loại

- [x] 2.1 Viết test cho `src/classify/lock.ts`: lấy và trả khoá, khoá của tiến trình còn sống (từ chối), khoá cũ (thay), file khoá hỏng, khoá là symlink (từ chối, không xoá), không xoá khoá của người khác; cài để pass
- [x] 2.2 Viết test lệnh: `classify --yes` khi có khoá sống (thoát 1, không gọi `claude`), khoá được xoá sau khi chạy xong và sau khi lỗi, chạy thử không tạo khoá; cài trong `classify.ts` để pass

## 3. Diff

- [x] 3.1 Viết test: diff CRLF và LF trong prompt có `␍`, các phần khác không đổi; cài trong `src/classify/prompt.ts` để pass

## 4. Kết thúc

- [x] 4.1 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
