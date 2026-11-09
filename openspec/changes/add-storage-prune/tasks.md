# Tasks: Cơ Chế Dọn Dẹp và Tối Ưu Dung Lượng Lưu Trữ (nightowl prune)

## 1. Cài đặt Tầng Lưu Trữ (Storage Layer)

- [x] 1.1 Cài đặt hàm `pruneStorage(db, options)` và `countPrunable(db, options)` trong `src/storage/prune.ts` và export qua `src/storage/store.ts`.
- [x] 1.2 Viết unit tests trong `test/storage/prune.test.ts` kiểm thử dọn dẹp snapshot, bảo toàn failures, tính toán ngày cutoff và gọi vacuum.

## 2. Cài đặt Lệnh CLI và Tích hợp

- [x] 2.1 Cài đặt `pruneCommand` trong `src/commands/prune.ts` hỗ trợ `--days <N>`, `--dry-run`, `--vacuum` và render thông báo kết quả ra stdout/stderr.
- [x] 2.2 Đăng ký `pruneCommand` vào `src/commands/index.ts` và cập nhật `test/cli/run.test.ts` bao gồm `prune`.
- [x] 2.3 Viết unit tests cho CLI trong `test/commands/prune.test.ts` kiểm thử tham số hợp lệ, tham số sai, chế độ dry-run, vacuum và báo cáo kết quả.

## 3. Kiểm thử Toàn diện và Xác thực Chất lượng

- [x] 3.1 Chạy `npm run typecheck`, `npm run build` và `npm run test:coverage` xác nhận toàn bộ test passed và coverage ≥ 95%.
- [x] 3.2 Chạy `npx openspec validate add-storage-prune --strict` xác nhận đạt chuẩn OpenSpec.

## Workflow follow-up

- Push nhánh `feat/storage-prune` lên GitHub và tạo Pull Request.
- Chờ GitHub Actions CI pass và tiến hành merge PR vào nhánh `main`.
- Chạy `npx openspec archive add-storage-prune` và đồng bộ spec vào nhánh chính.
