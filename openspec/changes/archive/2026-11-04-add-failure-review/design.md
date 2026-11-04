# Design

## Context

Xem proposal.md. Hành vi: `specs/failure-review`, `specs/cli`, `specs/failure-report`.

Hiện có:
- Bảng `failures` (schema v4) với `status` (CHECK `flagged`, `confirmed`, `dismissed`, mặc định `flagged`), `source`, `category`, `category_reason`, `prompt_event_id`, `feedback_event_id`, `ai_content`, `final_content`, `commit_sha`, `created_at`.
- `report` đếm `dismissed` riêng và không tính vào tổng. `export` bỏ lỗi `dismissed`.
- `unifiedDiff(ai, dev)` trong `src/classify/diff.ts` trả `null` khi hai bản khác nhau quá nhiều.
- `openExistingStore` mở database chỉ đọc và không bao giờ tạo `.nightowl/`.

## Goals / Non-Goals

**Goals:**
- Xem và phân loại vài chục lỗi trong vài phút, kể cả từ điện thoại qua Remote Control. Vì vậy chỉ dùng lệnh không tương tác, đầu ra ngắn.
- Không thể làm hỏng dữ liệu: id sai thì không đổi gì.

**Non-Goals:**
- Giao diện tương tác hay TUI.
- Lưu lịch sử ai đổi trạng thái và khi nào.

## Decisions

### 1. Một lệnh `review` với lệnh con
Không thêm bốn lệnh cấp cao (`list`, `show`, `confirm`, `dismiss`), vì chúng chiếm tên chung chung trong `nightowl --help`.

Lệnh con đầu tiên quyết định hành động: `list` (mặc định khi không có), `show`, `confirm`, `dismiss`, `reset`. Phần còn lại đọc bằng `parseArgs` với `strict: true`:
- `list` nhận `--status`, `--source`, `--limit`, không nhận tham số vị trí;
- `show` nhận đúng một id;
- `confirm`, `dismiss`, `reset` nhận một hoặc nhiều id, tối đa 200.

Id là số nguyên dương, tối đa 10 chữ số, viết là `12` hoặc `#12`. Trợ giúp chỉ khuyên dùng `12`, vì bash coi `#12` không có dấu nháy là comment và lặng lẽ bỏ nó đi. `--limit` chỉ nhận số thập phân, nên `1e2` hay `0x10` bị từ chối. `nightowl review --help` liệt kê mọi lệnh con và tuỳ chọn.

### 2. Danh sách
Mỗi lỗi một dòng, mới nhất trước, rộng không quá khoảng 100 ký tự:

```
#12  2026-11-05  ai-self-fix  logic         src/age.ts  +1 -1  "isAdult is true from 18"
#11  2026-11-05  manual-fix   unclassified  src/api/user.ts  +4 -2  "add email validation"
2 of 2 flagged. Show one: nightowl review show <id>
```

- Số dòng thêm và bỏ dùng `compareContent(ai_content, final_content)`, tính trong TypeScript. Danh sách giới hạn tối đa 200 lỗi, nên việc đọc nội dung code là chấp nhận được.
- Prompt được cắt còn 40 ký tự (theo code point), một dòng, bỏ ký tự điều khiển.
- Đường dẫn và prompt đi qua `printable`.

### 3. Chi tiết
```
#12  ai-self-fix  flagged
File      src/age.ts
Commit    3f2a9c1d8e07  2026-11-05 09:30 UTC
Category  logic (0.82): wrong boundary condition

Prompt
  isAdult is true from 18
Feedback
  wrong, 18 counts as adult

Diff (AI version → final)
  @@ -1 +1 @@
  -const isAdult = (age) => age > 18;
  +const isAdult = (age) => age >= 18;

Mark it: nightowl review confirm 12  |  nightowl review dismiss 12
```
- Diff dùng `unifiedDiff`. Khi nó trả `null`, in "(the versions differ too much to diff)" kèm số dòng.
- Diff tối đa 200 dòng; phần thừa ghi "… N more lines".
- Mỗi dòng đi qua một bộ lọc giữ tab nhưng thay mọi ký tự điều khiển khác (kể cả mã escape) và ký tự đảo chiều hay ẩn chữ (U+200B–200F, U+202A–202E, U+2066–2069). Mọi trường đọc từ database cũng qua bộ lọc này, kể cả `commit_sha` và ngày.
- `\r` trong diff hiện thành `␍`, để thay đổi chỉ ở xuống dòng vẫn thấy được. Mỗi dòng diff tối đa 300 ký tự.

### 4. Đổi trạng thái
`setFailureStatus(ids, status)` trong một giao dịch `BEGIN IMMEDIATE`:
- đếm `SELECT COUNT(*) FROM failures WHERE id IN (json_each(?))`; số lượng khác số id (sau khi bỏ trùng) thì `ROLLBACK` và báo các id không có;
- `UPDATE failures SET status = ? WHERE id IN (...)`;
- trả số lỗi đã đổi và số lỗi vốn đã ở trạng thái đó.

Lệnh mở database chỉ đọc trước (`openExistingStore`) để kiểm tra database đã có và schema đúng phiên bản, rồi mới mở để ghi. Nhờ vậy nó không bao giờ tạo `.nightowl/` mới hay tự nâng schema; database cũ thì báo chạy `nightowl init`.

Đầu ra: `Dismissed 2 failures (#11, #12).` Nếu có lỗi vốn đã ở trạng thái đó: `#11 was already dismissed.`

### 5. Report
Thêm dòng `Reviewed: N confirmed, M dismissed, K still flagged`. JSON thêm `by_status` với cả ba khoá. Tổng và các mục khác không đổi: `dismissed` vẫn không được tính.

## Risks / Trade-offs

- [Dismiss nhầm] → `reset` đưa lỗi về `flagged`; không có gì bị xoá.
- [Danh sách dài trên điện thoại] → Mặc định 20 lỗi, chỉ lỗi `flagged`, mỗi lỗi một dòng.
- [Diff lớn] → Giới hạn 200 dòng và `unifiedDiff` đã có giới hạn số thay đổi.
