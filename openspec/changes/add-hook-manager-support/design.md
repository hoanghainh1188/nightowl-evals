# Design: Hỗ Trợ Tích Hợp Hook Managers (Husky & Lefthook)

## Context

Nhiều dự án hiện đại sử dụng công cụ quản trị Git hooks chuyên dụng như Husky hoặc Lefthook thay vì các script trực tiếp trong `.git/hooks/`:
- **Husky**: Cấu hình `core.hooksPath = .husky` và lưu các script tại thư mục `.husky/pre-commit`, `.husky/post-commit`.
- **Lefthook**: Cấu hình hooks qua file YAML (`lefthook.yml`, `lefthook.yaml`, `.lefthook.yml`, `.lefthook.yaml`) và quản lý thực thi tập trung.

Hiện tại, `nightowl init` chỉ phát hiện `core.hooksPath` và trả về kết quả `manual` chung chung kèm dòng shell script tiêu chuẩn. Đồng thời, `nightowl doctor` chỉ kiểm tra trong thư mục `.git/hooks/`, dẫn đến báo cáo cảnh báo sai (false warning) khi dự án đã cấu hình NightOwl thành công bên trong Husky hoặc Lefthook.

## Goals / Non-Goals

**Goals:**
- Tự động nhận diện công cụ quản lý hook đang được sử dụng trong repo (Husky, Lefthook, hoặc Git native).
- Cung cấp snippet cấu hình và hướng dẫn chính xác cho từng công cụ trong `nightowl init`:
  - Husky: Hướng dẫn đường dẫn file `.husky/pre-commit` và `.husky/post-commit`.
  - Lefthook: Xuất snippet YAML mẫu tương thích với cấu trúc của Lefthook.
- Cập nhật `nightowl doctor` để nhận diện và kiểm tra hook từ đúng vị trí của hook manager (file `.husky/*` hoặc file cấu hình `lefthook.yml`).
- Viết unit tests độc lập với đầy đủ kịch bản phát hiện và sinh snippet.

**Non-Goals:**
- Không tự động ghi đè hoặc parse cú pháp phức tạp vào `lefthook.yml` hiện có của người dùng (tránh làm mất comment, format tùy biến).
- Không tự cài đặt package npm của Husky hay Lefthook.

## Decisions

### Quyết định 1: Module hóa Logic Nhận diện Hook Manager
- **Lựa chọn**: Tạo `src/setup/hook-manager.ts` định nghĩa:
  ```typescript
  export type HookManagerKind = 'husky' | 'lefthook' | 'none';

  export interface HookManagerInfo {
    readonly kind: HookManagerKind;
    readonly detail: string;
    readonly getInstructions: (hookName: string, command: string) => string;
  }
  ```
- **Lý do**: Tách biệt rõ ràng trách nhiệm (Single Responsibility), giúp `src/commands/init.ts` và `src/commands/doctor.ts` cùng tái sử dụng một nguồn sự thật duy nhất mà không bị trùng lặp logic.

### Quyết định 2: Chiến lược Nhận diện Chính xác (Detection Strategy)
1. **Lefthook**:
   - Kiểm tra sự tồn tại của một trong các file: `lefthook.yml`, `lefthook.yaml`, `.lefthook.yml`, `.lefthook.yaml`.
2. **Husky**:
   - Kiểm tra `core.hooksPath` bắt đầu hoặc chứa `.husky`.
   - Hoặc thư mục `.husky/` tồn tại trong thư mục gốc của repo.

### Quyết định 3: Tích hợp trong `nightowl init` và `nightowl doctor`
- Trong `nightowl init`:
  - Khi một hook bị đánh dấu `manual` do `core.hooksPath` hoặc hook manager, kiểm tra `detectHookManager`.
  - In thông báo hướng dẫn chuyên biệt kèm snippet (YAML cho Lefthook, đường dẫn file cho Husky).
- Trong `nightowl doctor`:
  - Thay vì chỉ đọc `.git/hooks/${hook.name}`, kiểm tra hook manager trước.
  - Nếu là Husky: đọc `.husky/${hook.name}`.
  - Nếu là Lefthook: đọc nội dung file config Lefthook và tìm kiếm `nightowl ${command}`.
  - Báo cáo rõ ràng: ví dụ `✓ pre-commit (husky) runs 'nightowl precommit'`.

## Risks / Trade-offs

- **[Risk]** Người dùng có cả thư mục `.husky/` cũ và file `lefthook.yml`.  
  → **Mitigation**: Ưu tiên kiểm tra theo cấu hình git đang hoạt động (`core.hooksPath`). Nếu `core.hooksPath` trỏ tới `.husky`, ưu tiên Husky; nếu không có `core.hooksPath` mà có file Lefthook, ưu tiên Lefthook.
