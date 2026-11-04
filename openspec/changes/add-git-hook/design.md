# Design

## Context

Xem proposal.md. Hành vi: `specs/git-hook`, `specs/project-setup`. Dựa trên: bảng `events` (change 2), sự kiện `edit` có `snapshot` (change 3), `.nightowl/nightowl.log` và lớp an toàn của các hook (change 1, 3).

## Goals / Non-Goals

**Goals:**
- Mỗi lần AI sửa file có đúng một kết quả: dev giữ nguyên hay sửa lại.
- Không bao giờ làm commit chậm thấy rõ hay thất bại.

**Non-Goals:**
- Diff chính xác theo từng dòng (change 5 làm khi dựng bản ghi lỗi).
- Biết mã commit: lúc `pre-commit` chạy commit chưa tồn tại. Change 5 có thể ghép sau qua `post-commit` nếu cần.

## Decisions

### 1. Chạy ở `pre-commit`, đọc nội dung staged
Ở `pre-commit`, nội dung staged chính là thứ sắp được commit, và tool vẫn ghi được trước khi commit diễn ra.
*Phương án khác:* `post-commit`: biết mã commit nhưng chạy sau; `prepare-commit-msg`: không chạy với một số luồng (`--no-edit`). Cả hai đều có thể thêm sau.

### 2. Gọi `git` ít lần nhất
- `git diff --cached --name-only -z --diff-filter=AM`: lấy danh sách file staged.
- Lọc với các file có sự kiện `edit` chưa kiểm tra (một truy vấn SQLite).
- `git cat-file --batch` một tiến trình duy nhất, đọc nội dung `:<path>` của mọi file cần so.

Tổng cộng 2 tiến trình con, không phụ thuộc số file.

### 3. "Chưa kiểm tra" = chưa có dòng trong `checked_edits`
Bảng `checked_edits (edit_id PRIMARY KEY, check_id)` (thuộc schema v1 của change 2) ghi lần `commit-check` nào đã tính mỗi sự kiện `edit`. Ghi `commit-check` và các dòng `checked_edits` trong cùng một transaction. Truy vấn "chưa kiểm tra" chỉ đọc cột có index (`id`, `file_path`, `session_id`), không đọc payload; ảnh chụp chỉ được đọc cho sự kiện mới nhất của mỗi file.
*Phương án ban đầu bị bỏ:* tìm id trong `payload.ai_event_ids` của mọi `commit-check` cũ bằng `json_each`. Review đo được 3,2 giây với 300 `commit-check` cũ (100 KB mỗi cái) và 500 file, và chậm dần theo thời gian dùng. Cách mới chạy dưới 200 ms với cùng dữ liệu (có test). `payload.ai_event_ids` vẫn được giữ để đọc cho tiện.

Nếu sự kiện mới nhất của file không có ảnh chụp, không lùi về ảnh chụp cũ hơn (sẽ so với nội dung đã lỗi thời): ghi `outcome: "skipped"`, `skipped_reason: "no_snapshot"`.

Danh sách file staged dùng `--no-renames`: mặc định `git diff` gộp xoá + thêm thành đổi tên (`R`), và `--diff-filter=AM` sẽ bỏ sót file AI viết.

### 4. Đếm dòng thay đổi kiểu xấp xỉ
Đếm dòng có trong bản này mà không có trong bản kia, theo multiset của các dòng. Đủ để gắn cờ và xếp hạng sơ bộ; diff thật để change 5. `whitespace_only` = hai bản bằng nhau sau khi bỏ mọi khoảng trắng.

### 5. Payload `commit-check`

```jsonc
{ "ai_event_ids": [41, 37], "outcome": "modified",          // hoặc "unchanged"
  "lines_added": 3, "lines_removed": 1, "whitespace_only": false,
  "staged_blob": "<sha git của blob>", "staged_content": "…",
  "staged_skipped": null }                                    // "too_large" khi > 512 KB
```

Lưu `staged_content` để change 5 không phải đọc lại git (commit có thể bị huỷ hoặc rebase sau đó).

### 6. Cài hook
- Đường dẫn: `git rev-parse --git-path hooks/pre-commit` (đúng cho worktree). Nếu `git config core.hooksPath` có giá trị → chỉ in hướng dẫn.
- Dòng được thêm, có đánh dấu để nhận diện khi chạy lại:
  `command -v nightowl >/dev/null 2>&1 && nightowl precommit >/dev/null 2>&1 || true  # nightowl-evals`
- Hook mới: `#!/bin/sh` + dòng trên, `chmod 755`. Hook có sẵn với shebang `sh`/`bash`/`zsh`: chèn sau shebang, giữ nguyên quyền file. Hook có sẵn không có shebang: chèn lên đầu và thêm `#!/bin/sh`. Hook có shebang khác (node, python…): không sửa, in hướng dẫn.

### 7. Ngân sách thời gian
Đặt hạn chót 2 giây từ lúc bắt đầu; mỗi file kiểm tra xong là ghi DB ngay, hết giờ thì dừng. Tiến trình `git` con và việc chờ khoá database (`openStore({ timeoutMs })`) đều chỉ được dùng phần thời gian còn lại. Phần `|| true` trong dòng hook là chốt chặn cuối: ngay cả khi `nightowl` crash, commit vẫn đi tiếp.

### 8. Ghi chú khi cài đặt
- `precommit` được coi là lệnh hook giống `log`: `main()` và `installProcessGuards()` luôn cho nó thoát 0 (`HOOK_COMMANDS` trong `src/cli/errors.ts`).
- `init` coi lỗi khi cài git hook (ví dụ không có `git`) là bước thủ công: in hướng dẫn, vẫn thoát 0.
- Test chạy `git` với `GIT_CONFIG_GLOBAL=/dev/null` và `GIT_CONFIG_NOSYSTEM=1` (`test/setup-env.ts`) để cấu hình git của máy dev không ảnh hưởng kết quả. Bản build cho test e2e được tạo một lần trong `globalSetup` vì các file e2e chạy song song.

## Risks / Trade-offs

- [Commit có cờ bỏ qua hook, hoặc commit qua IDE tắt hook] → Sự kiện `edit` vẫn ở trạng thái chưa kiểm tra; commit sau có file đó sẽ tính. Ghi chú trong README.
- [Dev stage một phần file (`git add -p`)] → So với nội dung staged nên kết quả vẫn đúng với cái được commit; phần chưa stage bị coi là chưa commit.
- [Dev commit nhiều ngày sau khi AI sửa, chen nhiều thay đổi khác] → Bị gắn `modified` dù không phải AI sai. Lọc nhiễu là việc của change sau (doc bước 4).
- [Commit bị huỷ sau `pre-commit` (message rỗng, hook `commit-msg` fail)] → Sự kiện `edit` đã bị tính; lần commit lại không so nữa. Chấp nhận ở MVP; `staged_content` vẫn lưu đúng bản đã định commit. Nếu thành vấn đề, chuyển việc đánh dấu sang `post-commit`.
- [`core.autocrlf` hoặc clean filter làm bản staged khác bản trên đĩa về xuống dòng] → Bị `modified` với `whitespace_only: true`, nên change sau lọc được. Blob rất lớn vẫn được `cat-file` đọc hết vào bộ nhớ trước khi bị bỏ (> 512 KB); chấp nhận ở MVP.
