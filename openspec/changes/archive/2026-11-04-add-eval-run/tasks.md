# Tasks

## 1. Chuẩn bị

- [x] 1.1 Tổng quát `runClaude` (schema và thời gian huỷ là tham số); giữ nguyên test của `classify`, thêm test cho schema khác

## 2. Đọc bộ test

- [x] 2.1 Viết test đọc JSONL: dòng hợp lệ, dòng hỏng, schema lạ, bài không có prompt, `file_before` > 64 KB, file không tồn tại; cài `src/eval/cases.ts` để pass

## 3. Chấm điểm

- [x] 3.1 Viết test `score`: giống `expected` → 1, giống `rejected` → 0, sửa một phần, chuẩn hoá khoảng trắng và dòng trống, multiset (dòng lặp), `added` rỗng, `removed` rỗng; cài `src/eval/score.ts` để pass

## 4. Gọi model

- [x] 4.1 Viết test dựng prompt (có/không có `file_before`, thẻ đóng bị vô hiệu hoá) và đọc đầu ra (`structured_output`, `result`, thiếu `content`, quá 512 KB); cài `src/eval/prompt.ts` và `src/eval/parse.ts` để pass

## 5. nightowl eval

- [x] 5.1 Viết test chạy thử: đúng số bài, số lời gọi, model mặc định, không gọi `runClaude`, không tạo `.nightowl/runs/`
- [x] 5.2 Viết test `--yes`: mỗi bài × mỗi model một lời gọi, bảng so sánh, danh sách bài khác nhau, file kết quả (quyền `0600`, đủ dòng), lời gọi lỗi vẫn chạy tiếp và thoát 1, không có `claude` → thoát 1 không tạo file, tuỳ chọn không hợp lệ; cài `src/commands/eval.ts` và đăng ký lệnh để pass
- [x] 5.3 Cập nhật `test/policy/no-network.test.ts`: chỉ `src/classify/` chạy `claude`; hook không import `src/eval/`

## 6. Kiểm tra đầu cuối

- [x] 6.1 Test e2e với `claude` giả trả lời khác nhau theo `--model`: commit thật → `export` → `eval` (chạy thử) → `eval --yes`, kiểm tra bảng và file kết quả
- [x] 6.2 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
- [x] 6.3 Thử với `claude` thật: 1 bài mẫu vô hại × 2 model (cần người dùng đồng ý vì có gửi dữ liệu) — đã thử 2026-11-04 với claude 2.1.311: haiku và sonnet đều trả về đúng file đã sửa (`age >= 18`), điểm 1,00, 9 giây cho cả hai; chi phí khoảng 0,006 USD/lần với haiku và 0,10 USD/lần với sonnet
