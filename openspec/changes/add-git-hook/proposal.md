# Proposal

## Why

Change 3 lưu được code AI viết. Muốn biết AI sai ở đâu thì phải so bản đó với bản dev thật sự commit: chỗ nào dev phải sửa lại là dấu hiệu AI sai. Change này gắn cờ "bị sửa" lúc commit. Xong change này là xong phần thu thập của tuần 1, và tool bắt đầu tích dữ liệu cho mục tiêu 50 lỗi thật.

## What Changes

- `nightowl init` cài thêm git hook `pre-commit` gọi `nightowl precommit`:
  - hook chưa có → tạo mới;
  - đã có hook shell khác → chèn một dòng gọi NightOwl, giữ nguyên phần còn lại;
  - repo dùng `core.hooksPath` (husky, lefthook…) hoặc hook không phải shell → không sửa file nào, in hướng dẫn tự thêm dòng gọi.
- Lệnh mới `nightowl precommit` (dùng cho git hook):
  - với mỗi file đang staged mà AI từng sửa (có sự kiện `edit` kèm ảnh chụp chưa được kiểm tra), so nội dung staged với ảnh chụp mới nhất của AI;
  - lưu một sự kiện nguồn `git`, loại `commit-check`, kết quả `unchanged` (dev giữ nguyên bản AI) hoặc `modified` (dev đã sửa), kèm số dòng thêm/bớt, cờ "chỉ khác khoảng trắng" và nội dung staged;
  - luôn im lặng, luôn thoát 0, không bao giờ chặn commit.

Ngoài phạm vi: ghép thành bản ghi lỗi (change 5), lọc nhiễu "dev đổi ý" (để sau), commit có cờ bỏ qua hook (hook không chạy, sự kiện `edit` chờ tới commit sau), các hook git khác.

## Capabilities

### New Capabilities

- `git-hook`: Kiểm tra lúc commit: so code AI viết với code được commit và lưu kết quả cho từng file.

### Modified Capabilities

- `project-setup`: `nightowl init` cài thêm git hook `pre-commit`. (Capability này do change 3 tạo; change này phải archive sau change 3.)

## Impact

- Code: `src/commands/precommit.ts`, `src/hooks/git/`, `src/setup/git-hook.ts`.
- Ghi vào `<git-dir>/hooks/pre-commit` của dự án đích.
- Lần đầu gọi tiến trình con `git` (local, không truy cập mạng). Test chính sách mạng vẫn giữ nguyên.
- Phụ thuộc change 2 và 3.
