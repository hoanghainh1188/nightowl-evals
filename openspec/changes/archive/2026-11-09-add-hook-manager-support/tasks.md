# Tasks: Hỗ Trợ Tích Hợp Hook Managers (Husky & Lefthook)

## 1. Cài đặt Module Nhận diện Hook Manager

- [x] 1.1 Tạo `src/setup/hook-manager.ts` với hàm `detectHookManager`, nhận diện Husky (`.husky/`, `core.hooksPath`) và Lefthook (`lefthook.yml`, `.lefthook.yml`, ...), kèm hàm sinh snippet cấu hình mẫu.
- [x] 1.2 Viết unit tests trong `test/setup/hook-manager.test.ts` kiểm thử các trường hợp nhận diện Husky, Lefthook, và snippet sinh ra.

## 2. Tích hợp vào Lệnh init và doctor

- [x] 2.1 Cập nhật `src/commands/init.ts` để hiển thị hướng dẫn/snippet chuyên biệt của Husky hoặc Lefthook khi gặp hook manager.
- [x] 2.2 Cập nhật `src/commands/doctor.ts` để nhận diện hook manager và kiểm tra hook tương ứng trong `.husky/` hoặc `lefthook.yml`.
- [x] 2.3 Cập nhật kiểm thử trong `test/commands/init.test.ts` và `test/commands/doctor.test.ts` cho các trường hợp Husky và Lefthook.

## 3. Kiểm thử Toàn diện và Xác thực Chất lượng

- [x] 3.1 Chạy `npm run typecheck`, `npm run build` và `npm run test:coverage` xác nhận toàn bộ test passed và coverage ≥ 95%.
- [x] 3.2 Chạy `npx openspec validate add-hook-manager-support --strict` xác nhận đạt chuẩn OpenSpec.

## Workflow follow-up

- Push nhánh `feat/hook-manager-support` lên GitHub và tạo Pull Request.
- Chờ GitHub Actions CI pass và tiến hành merge PR vào nhánh `main`.
- Chạy `npx openspec archive add-hook-manager-support` và đồng bộ spec vào nhánh chính.
