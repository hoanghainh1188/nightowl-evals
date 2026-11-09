# Tasks: Lệnh Chẩn Đoán Môi Trường và Cấu Hình (nightowl doctor)

## 1. Cài đặt Lệnh Doctor và Kiểm tra Chẩn đoán

- [x] 1.1 Tạo `src/commands/doctor.ts` với interface `DoctorDeps`, các hàm chẩn đoán 5 nhóm thành phần (Node.js & SQLite, Git repo & binary, Claude Code hook, Git hooks, Database health) và render kết quả chẩn đoán trực quan.
- [x] 1.2 Đăng ký `doctorCommand` vào `src/commands/index.ts` và cập nhật test trợ giúp `test/cli/help.test.ts` để hiển thị `doctor`.

## 2. Kiểm thử và Xác thực Chất lượng

- [x] 2.1 Viết kiểm thử `test/commands/doctor.test.ts` bao phủ các trường hợp đạt chuẩn, cảnh báo khi chưa khởi tạo, lỗi phiên bản Node, lỗi ngoài Git repo, lỗi database bị hỏng, và cờ `--strict`.
- [x] 2.2 Chạy `npm run typecheck`, `npm run build` và `npm run test:coverage` để xác nhận toàn bộ test passed và coverage ≥ 95%.
- [x] 2.3 Chạy `npx openspec validate add-doctor-command --strict` để đảm bảo tuân thủ tiêu chuẩn spec.

## Workflow follow-up

- Push nhánh `feat/doctor-command` lên GitHub và tạo Pull Request.
- Chờ GitHub Actions CI pass và tiến hành merge PR vào nhánh `main`.
- Chạy `npx openspec archive add-doctor-command` và đồng bộ spec vào nhánh chính.
