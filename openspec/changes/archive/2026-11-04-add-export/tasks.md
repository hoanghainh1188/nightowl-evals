# Tasks

## 1. Đọc dữ liệu

- [x] 1.1 Viết test cho truy vấn lấy bản ghi lỗi để xuất: bỏ `dismissed`, lọc `--since`, lọc nhiều `--category` kể cả `unclassified`, kèm prompt, đúng thứ tự; cài trong `src/storage/` để pass
- [x] 1.2 Viết test đọc file ở commit cha bằng một tiến trình `git cat-file --batch` (file có, file mới, commit gốc, commit không còn, đường dẫn có dấu cách/Unicode/xuống dòng, file > 512 KB); cài `src/export/file-before.ts` để pass

## 2. Dựng bài test

- [x] 2.1 Viết test `toEvalCase`: đủ trường, thứ tự khoá cố định, `id` ổn định, bản chưa phân loại, không có prompt; cài `src/export/eval-case.ts` để pass

## 3. Ghi file

- [x] 3.1 Viết test ghi file: quyền `0600`, thư mục `0700`, ghi nguyên tử, từ chối symlink, thư mục cha không tồn tại → lỗi; mở rộng `writeFileAtomic` với tham số quyền để pass

## 4. nightowl export

- [x] 4.1 Viết test lệnh: mặc định ghi `.nightowl/export/evals.jsonl`, `--out <file>`, `--out -`, xuất lại giống hệt, tuỳ chọn không hợp lệ (không ghi gì), chưa có `.nightowl/` (không tạo gì), ngoài repo, database không đổi; thay lệnh rỗng bằng `src/commands/export.ts` để pass
- [x] 4.2 Xoá `src/commands/not-implemented.ts` và test của nó khi cả `report` và `export` đã có

## 5. Kiểm tra đầu cuối

- [x] 5.1 Test e2e với git thật: `init`, file có sẵn `v0`, AI viết `v1`, dev commit `v2` → `nightowl export` cho một dòng với `file_before`/`rejected`/`expected` đúng; xác nhận `.nightowl/export/` bị `git status` bỏ qua
- [x] 5.2 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`

## Workflow follow-up

- Archive sau `add-report` (cả hai xoá lệnh rỗng; `add-export` làm bước xoá cuối).
