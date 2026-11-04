# Proposal

## Why

Sau tuần 1, mỗi lần commit đã có sự kiện `commit-check` nói file AI viết bị sửa hay không. Nhưng đó mới là dữ liệu thô, rải trong bảng `events`. Muốn đếm "≥ 50 lỗi thật", phân loại (change 6), báo cáo (change 7) và xuất bộ test (change 8) thì cần một bản ghi lỗi gọn: đầu vào (prompt), bản AI viết, bản dev commit. Change này dựng bản ghi đó trong bảng `failures`.

## What Changes

- `nightowl init` cài thêm git hook `post-commit` gọi `nightowl postcommit`, cùng cách an toàn như `pre-commit` (không bao giờ làm git lỗi, tôn trọng `core.hooksPath`, hook không phải shell, symlink).
- Lệnh mới `nightowl postcommit` (dùng cho git hook): với mỗi `commit-check` kết quả `modified` chưa gắn commit, nếu file trong commit vừa tạo đúng là bản đã kiểm tra (cùng blob), tạo một bản ghi trong `failures`:
  - `ai_content` = ảnh chụp AI viết, `final_content` = bản dev commit, `commit_sha` = commit vừa tạo;
  - `prompt_event_id` = prompt gần nhất của cùng phiên Claude Code trước lần AI sửa đầu tiên (nếu có);
  - `status` = `flagged`, `category` để trống (change 6 điền).
- Lọc nhiễu tối thiểu: không tạo bản ghi khi thay đổi chỉ là khoảng trắng.
- Commit bị huỷ sau `pre-commit` sẽ không sinh bản ghi lỗi, vì `post-commit` không chạy. Điều này giải quyết rủi ro đã ghi trong change 4.
- Migration schema v2: thêm cột `prompt_event_id` và bảng `checks_attached` (các `commit-check` đã được xử lý ở `post-commit`).
- Lệnh `nightowl failures` in số bản ghi lỗi theo trạng thái, để biết đã tới mốc 50 chưa.

Ngoài phạm vi: phân loại (change 6), báo cáo theo loại/module/tuần (change 7), cho dev bỏ đánh dấu một lỗi (để sau), lọc nhiễu "dev đổi ý" bằng heuristic phức tạp hơn.

## Capabilities

### New Capabilities

- `failure-records`: Dựng bản ghi lỗi từ kết quả kiểm tra lúc commit: khi nào tạo, gồm những gì, và cách đếm.

### Modified Capabilities

- `project-setup`: `nightowl init` cài thêm git hook `post-commit`.

## Impact

- Code: `src/commands/postcommit.ts`, `src/commands/failures.ts`, `src/hooks/git/` (thêm phần post-commit), `src/setup/git-hook.ts` (tổng quát cho nhiều hook), `src/storage/` (migration v2, đọc ghi `failures`).
- Dự án đích: thêm `<git-dir>/hooks/post-commit`.
- Người đã chạy `nightowl init` ở tuần 1 cần chạy lại `nightowl init` để có hook `post-commit` (chạy lại an toàn).
