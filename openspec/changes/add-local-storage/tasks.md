# Tasks

## 1. Mở database

- [ ] 1.1 Viết test cho `findProjectRoot`: repo thường, thư mục con, `.git` là file (worktree), ngoài repo; xác nhận fail rồi cài `src/storage/project-root.ts` để pass
- [ ] 1.2 Viết test spawn `node` mở database và khẳng định stderr không có `ExperimentalWarning`, cảnh báo khác vẫn được in; cài `src/storage/sqlite.ts` (bọc `emitWarning`, import động) để pass
- [ ] 1.3 Viết test cho `openStore`: tạo `.nightowl/nightowl.db` ở gốc repo, bật WAL và `busy_timeout`, báo lỗi ngoài repo không tạo file; cài để pass

## 2. Schema và migration

- [ ] 2.1 Viết test migration: DB mới lên v1 có đủ hai bảng và index, mở lại không đổi gì, DB có `user_version` lớn hơn thì báo lỗi không sửa file; cài `src/storage/migrations.ts` để pass
- [ ] 2.2 Viết test ràng buộc schema: `source` sai, `payload` không phải JSON, `category`/`status` sai đều bị từ chối; chèn `failures` hợp lệ thành công

## 3. Đọc ghi events

- [ ] 3.1 Viết test `insertEvent`/`listEvents` (ghi rồi đọc lại đủ trường, lọc theo file, thời điểm, loại); cài `src/storage/events.ts` để pass
- [ ] 3.2 Viết test hai tiến trình con mỗi bên ghi 50 sự kiện cùng lúc và có đủ 100 dòng; kiểm tra pass trên Node 22.13 và 24 qua CI
- [ ] 3.3 Viết test chỉ file trong `.nightowl/` bị tạo hoặc sửa sau khi ghi; cập nhật `test/policy/no-network.test.ts` nếu cần; chạy `npm run test:coverage` đạt ≥ 80%
