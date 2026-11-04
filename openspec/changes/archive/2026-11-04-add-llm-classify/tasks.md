# Tasks

## 1. Chuẩn bị

- [x] 1.1 Viết test migration v2 → v3 (4 cột mới, ràng buộc `category_confidence`, dữ liệu cũ giữ nguyên); thêm migration để pass
- [x] 1.2 Viết test `nightowl log` với `NIGHTOWL_INTERNAL=1`: không có sự kiện mới, không ghi `nightowl.log`, im lặng, thoát 0; cài để pass

## 2. Dựng prompt

- [x] 2.1 Viết test cho diff Myers dạng unified (giống nhau, thêm, xoá, sửa giữa file, file rỗng, file không có xuống dòng cuối); cài `src/classify/diff.ts` để pass
- [x] 2.2 Viết test dựng prompt: có/không có prompt người dùng, cắt 20 KB theo byte UTF-8 kèm ghi chú, có đủ 4 định nghĩa loại lỗi; cài `src/classify/prompt.ts` để pass

## 3. Gọi Claude Code CLI

- [x] 3.1 Viết test đọc kết quả: `structured_output`, `result` dạng chuỗi JSON, JSON hỏng, loại lạ, độ tin cậy ngoài 0–1, thiếu trường; cài `src/classify/parse.ts` để pass
- [x] 3.2 Viết test `runClaude` với file `claude` giả trong `PATH`: đúng cờ (`-p`, `--output-format json`, `--json-schema`, `--tools ""`, `--no-session-persistence`, `--model`), prompt qua stdin, `NIGHTOWL_INTERNAL=1`, `cwd` là thư mục tạm đã bị xoá sau đó, huỷ khi quá thời gian; cài `src/classify/run-claude.ts` để pass

## 4. nightowl classify

- [x] 4.1 Viết test chạy thử (không `--yes`): liệt kê đúng lỗi, không gọi `runClaude`, DB không đổi, thoát 0
- [x] 4.2 Viết test `--yes`: lưu đủ trường, bỏ qua lỗi đã phân loại, `--redo`, `--limit`, `--model`, một lỗi thất bại vẫn xử lý tiếp và thoát 1, không có `claude` → mã 1 và DB không đổi; cài `src/commands/classify.ts` và đăng ký lệnh để pass
- [x] 4.3 Cập nhật `test/policy/no-network.test.ts`: vẫn không có module mạng, và chỉ `src/classify/` được phép chạy `claude`

## 5. Kiểm tra đầu cuối

- [x] 5.1 Test e2e với `claude` giả: dựng 2 bản ghi lỗi qua git thật, `nightowl classify` (chạy thử), rồi `--yes`, kiểm tra DB
- [x] 5.2 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
- [ ] 5.3 Thử với `claude` thật trên 1 bản ghi lỗi mẫu không chứa code nhạy cảm; xác nhận định dạng đầu ra khớp design mục 2 (cần người dùng đồng ý vì có gửi dữ liệu)
