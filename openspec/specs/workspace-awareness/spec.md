# workspace-awareness Specification

## Purpose

Nhận diện package/workspace roots trong repo git local và ánh xạ đường dẫn file sang nhãn workspace/module ổn định, kèm khả năng lọc theo tên workspace — không gọi mạng và không tạo DB multi-repo.

## Requirements

### Requirement: Phát hiện workspace local
NightOwl SHALL cung cấp API/profile nội bộ đã document để phát hiện workspace/package roots trong cây dự án từ cấu hình đã hỗ trợ (ít nhất `package.json` field `workspaces` và/hoặc `pnpm-workspace.yaml`), đọc `name` package khi có. Phát hiện SHALL NOT gọi mạng. Khi không có cấu hình workspace, kết quả SHALL là tập rỗng (caller giữ semantics depth cũ).

#### Scenario: pnpm/npm workspaces
- **WHEN** repo có `pnpm-workspace.yaml` hoặc `package.json` `workspaces` trỏ tới `packages/*` và tồn tại `packages/ui/package.json`
- **THEN** discovery gồm root tương ứng `packages/ui` (và name nếu có trong package.json)

#### Scenario: Không có workspace
- **WHEN** repo không có cấu hình workspace đã hỗ trợ
- **THEN** discovery trả về danh sách rỗng; không lỗi

### Requirement: Ánh xạ path → workspace
Cho một đường dẫn file relative trong repo, NightOwl SHALL xác định workspace bao gần nhất (longest-prefix package root) nếu path nằm dưới một root đã phát hiện; nếu không thuộc workspace nào, SHALL báo không khớp (caller dùng `moduleOf` depth).

#### Scenario: File trong package
- **WHEN** path `packages/ui/src/Button.tsx` và root `packages/ui` đã phát hiện
- **THEN** workspace khớp là `packages/ui` (hoặc `name` package đã document là nhãn chính)

### Requirement: Filter theo tên workspace
Khi caller truyền một hoặc nhiều tên workspace đã document, filter SHALL chỉ giữ path thuộc workspace khớp (theo path root và/hoặc `name`). Tên không khớp workspace nào đã biết SHALL được xử lý rõ (lỗi cấu hình hoặc tập rỗng — chọn một hành vi và document).

#### Scenario: Lọc một workspace
- **WHEN** filter `ui` (hoặc `packages/ui` theo design) và có path trong/ngoài package đó
- **THEN** chỉ path thuộc workspace khớp được giữ

### Requirement: Discovery phục vụ chẩn đoán doctor
API/profile discovery workspace đã document SHALL dùng được offline bởi `nightowl doctor` để báo trạng thái monorepo trên máy local. Discovery cho doctor SHALL NOT gọi mạng và SHALL cùng semantics với discovery dùng cho report (cùng nguồn config đã hỗ trợ).

#### Scenario: Doctor dùng cùng discovery
- **WHEN** repo có workspace config hợp lệ với ≥1 package và chạy `nightowl doctor`
- **THEN** kết quả doctor phản ánh discovery không rỗng (ok packages), khớp với việc discovery API trả về ≥1 workspace cho cùng root
