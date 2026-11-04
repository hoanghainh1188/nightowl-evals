# Design

## Context

Xem proposal.md. Hành vi: `specs/failure-records`, `specs/project-setup`. Dựa trên tuần 1:
- sự kiện `commit-check` có `ai_event_ids`, `outcome`, `whitespace_only`, `staged_blob`, `staged_content`;
- bảng `failures` (schema v1) và `checked_edits`;
- cách cài hook an toàn trong `src/setup/git-hook.ts`, lớp an toàn của lệnh hook (`HOOK_COMMANDS`, luôn thoát 0).

## Goals / Non-Goals

**Goals:**
- Chỉ commit thật sự diễn ra mới sinh bản ghi lỗi.
- Bản ghi đủ cho change 6–8 mà không phải đọc lại git: prompt, bản AI, bản cuối, mã commit.

**Non-Goals:**
- Diff chính xác lưu sẵn trong DB (change 7/8 tự tính khi cần từ hai bản nội dung).
- Giao diện cho dev bỏ đánh dấu lỗi.

## Decisions

### 1. Tạo bản ghi ở `post-commit`, không ở `pre-commit`
`pre-commit` vẫn ghi `commit-check` như tuần 1. `post-commit` chạy sau khi commit đã tạo xong, nên biết mã commit và chắc chắn commit không bị huỷ. Đây cũng là cách xử lý rủi ro "commit bị huỷ sau `pre-commit`" đã ghi ở change 4.
*Phương án khác:* tạo bản ghi ngay ở `pre-commit` và điền `commit_sha` sau: sinh bản ghi rác khi commit bị huỷ, phải dọn lại.

### 2. Khớp `commit-check` với commit bằng blob
`git cat-file --batch-check` (một tiến trình, đường dẫn qua stdin) với đầu vào `HEAD:<path>` cho sha blob của từng file trong commit vừa tạo. `commit-check` khớp khi sha này bằng `staged_blob`.
Với mỗi file chỉ xét `commit-check` chưa xử lý mới nhất. Các `commit-check` chưa xử lý cũ hơn của cùng file được đánh dấu `superseded` (đã có lần kiểm tra mới hơn thay thế), nên không bị xét mãi.
`commit-check` mới nhất không khớp thì để nguyên chưa xử lý: có thể commit bị huỷ, hoặc dev sẽ commit đúng bản đó ở lần sau.

### 3. Schema v2

```sql
ALTER TABLE failures ADD COLUMN prompt_event_id INTEGER REFERENCES events (id);

-- Mỗi commit-check được xử lý ở post-commit nhiều nhất một lần.
CREATE TABLE checks_attached (
  check_id    INTEGER PRIMARY KEY REFERENCES events (id),
  outcome     TEXT NOT NULL CHECK (outcome IN ('failure', 'not-a-failure', 'superseded')),
  commit_sha  TEXT,
  failure_id  INTEGER REFERENCES failures (id)
);
```

Tạo `failures` và các dòng `checks_attached` trong cùng một transaction. Migration chạy tự động khi mở database (cơ chế change 2).

### 4. Tìm prompt
Lấy sự kiện `edit` đầu tiên trong `ai_event_ids` (id nhỏ nhất). Prompt là sự kiện `kind = 'prompt'` cùng `session_id`, có `id` nhỏ hơn, lấy cái gần nhất. Không có phiên hoặc không có prompt thì để `NULL`.

### 5. Tổng quát hoá cài hook
`installPreCommit` thành `installGitHook(root, name, command)`; `init` gọi cho `pre-commit` (`nightowl precommit`) và `post-commit` (`nightowl postcommit`). Cùng dấu `# nightowl-evals`, cùng quy tắc với symlink, `core.hooksPath` và hook không phải shell. Kết quả cài từng hook được báo riêng.

### 6. `postcommit` là lệnh hook
Thêm vào `HOOK_COMMANDS`: luôn thoát 0, im lặng, không tạo `.nightowl/` nếu chưa có, ngân sách 2 giây (dùng chung cách tính thời gian còn lại với `precommit`).

### 7. `nightowl failures`
In ra stdout, ví dụ:
```
3 failures recorded
  flagged: 3
```
Đọc qua `openStore`; ngoài repo git thì báo lỗi, thoát 1. Đây là lệnh để người dùng theo dõi mốc 50 lỗi; báo cáo đầy đủ để change 7.

## Risks / Trade-offs

- [Rebase, amend, cherry-pick cũng chạy `post-commit`] → Một `commit-check` chỉ được xử lý một lần, nên không bị nhân đôi; `commit_sha` có thể là commit trước khi rebase. Chấp nhận ở MVP.
- [Commit qua IDE hoặc công cụ tắt hook] → `commit-check` để nguyên chưa xử lý; lần `post-commit` sau sẽ khớp nếu file vẫn giữ đúng blob đó.
- [Người dùng tuần 1 chưa có hook `post-commit`] → `commit-check` cũ chờ tới khi chạy lại `nightowl init`. Ghi chú trong báo cáo khi xong change.
