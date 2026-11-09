# Proposal: Hỗ Trợ Tích Hợp Hook Managers (Husky & Lefthook)

## Why

Rất nhiều dự án TypeScript/JavaScript và đa ngôn ngữ hiện đại sử dụng công cụ quản lý Git hooks như Husky (`.husky/`, `core.hooksPath`) hoặc Lefthook (`lefthook.yml`). Khi gặp các công cụ này, `nightowl init` hiện chỉ dừng lại ở việc báo lỗi `manual` chung chung kèm dòng shell script thông thường, khiến người dùng bối rối khi cấu hình. Việc nhận diện thông minh Husky và Lefthook để cung cấp chính xác snippet tích hợp (hoặc hỗ trợ cấu hình) giúp đơn giản hóa quy trình cài đặt và nâng cao trải nghiệm lập trình viên.

## What Changes

- Tự động nhận diện công cụ quản lý hook đang có trong dự án:
  - **Husky**: Khi `core.hooksPath` trỏ tới `.husky` hoặc thư mục `.husky/` tồn tại trong repo.
  - **Lefthook**: Khi file `lefthook.yml`, `lefthook.yaml`, `.lefthook.yml`, hoặc `.lefthook.yaml` tồn tại trong repo.
- Nâng cấp thông báo của `nightowl init` khi gặp hook manager:
  - Với **Husky**: Cung cấp hướng dẫn thêm lệnh vào `.husky/pre-commit` và `.husky/post-commit`.
  - Với **Lefthook**: Xuất đoạn snippet cấu hình YAML mẫu sẵn sàng sao chép vào `lefthook.yml`.
- Nâng cấp `nightowl doctor`:
  - Kiểm tra xem Husky hoặc Lefthook đã được cấu hình gọi `nightowl precommit` và `nightowl postcommit` chưa, thay vì chỉ kiểm tra `.git/hooks/`.

## Capabilities

### Modified Capabilities
- `project-setup`: Nâng cấp requirement "Không sửa hook do công cụ khác quản lý" và "Chẩn đoán môi trường và cấu hình" để nhận diện Husky, Lefthook, cung cấp snippet cấu hình phù hợp và hỗ trợ kiểm tra sức khỏe trong `nightowl doctor`.

## Impact

- **Setup & Hook Detection**: Bổ sung hàm phát hiện hook manager trong `src/setup/hook-manager.ts` hoặc `src/setup/git-hook.ts`.
- **Init & Doctor CLI**: Cập nhật `src/commands/init.ts` và `src/commands/doctor.ts` để hiển thị hướng dẫn và kiểm tra tương thích.
- **Kiểm thử**: Bổ sung unit tests trong `test/setup/hook-manager.test.ts`, `test/commands/init.test.ts`, và `test/commands/doctor.test.ts`.
- **Nguyên tắc an toàn**: Vẫn giữ vững quy tắc không tự ý phá vỡ cấu hình hook manager hiện có của người dùng.
