# Design

## Context

Xem proposal.md.
- `openExistingStore(cwd)` mở database chỉ đọc khi `.nightowl/nightowl.db` đã có, và báo khi schema cũ.
- `review.ts` có `openForWrite`: mở chỉ đọc để kiểm tra trước, rồi mới mở để ghi.
- `classify` hiện dùng `openStore`, nên tạo thư mục và chạy migrate.
- `unifiedDiff` giữ nguyên `\r` trong từng dòng.

## Goals / Non-Goals

**Goals:** ba lỗi trong proposal, không đổi schema.

**Non-Goals:** khoá liên tiến trình tổng quát cho mọi lệnh.

## Decisions

### 1. Một hàm mở để ghi dùng chung
Chuyển `openForWrite` từ `review.ts` sang `existing-store.ts`, đổi tên thành `openExistingStoreForWrite(cwd)`. `review` và `classify` cùng dùng nó; `failures` dùng `openExistingStore`.

### 2. Khoá bằng file
`.nightowl/classify.lock` chứa JSON `{ "pid": 1234, "started_at": "…" }`, chế độ `0600`.

Lấy khoá:
- Ghi đầy đủ nội dung vào một file tạm tên ngẫu nhiên trong `.nightowl/`, rồi `link` file tạm vào `classify.lock`. `link` là thao tác nguyên tử và thất bại nếu khoá đã có, nên không tiến trình nào đọc phải một khoá đang ghi dở. Sau đó xoá file tạm.
- Khoá đã có thì đọc PID và gọi `process.kill(pid, 0)`:
  - Thành công, hoặc lỗi `EPERM`: tiến trình còn sống, nên từ chối.
  - Lỗi `ESRCH`, file hỏng, hoặc PID không phải số nguyên dương: khoá cũ.
- Thay khoá cũ an toàn: `rename` khoá sang một tên ngẫu nhiên (nguyên tử), rồi đọc lại thứ vừa dời đi.
  - Nếu nó không phải đúng khoá cũ đã xét (một tiến trình khác vừa thay khoá ở giữa), trả nó về chỗ cũ bằng `link` và báo đang có lần chạy khác.
  - Nếu đúng, xoá nó và thử `link` lại một lần.
- Đường dẫn khoá là symlink: từ chối và báo lỗi, không xoá, không đi theo symlink.
- Lỗi hệ thống (thư mục không ghi được, đầy đĩa) được báo thành lỗi khoá có thông báo rõ.

Giải phóng khoá trong `finally`: chỉ xoá file nếu nội dung vẫn đúng là của mình, để không xoá nhầm khoá của tiến trình khác.

Khoá được lấy trước khi đọc danh sách lỗi, nên hai lần chạy không bao giờ chọn trùng lỗi. Vì vậy `--yes` khi không có gì để phân loại vẫn báo "đang có lần chạy khác" nếu có tiến trình khác giữ khoá.

Không dùng SQLite cho khoá: `classify` giữ kết nối mở suốt nhiều phút trong lúc chờ Claude. Một giao dịch dài như vậy sẽ chặn các hook ghi vào database, mà hook chỉ có 2 giây.

Khoá chỉ áp cho máy này. `.nightowl/` là dữ liệu cục bộ, không dùng chung qua mạng.

### 3. `\r` trong diff
Trong `buildPrompt`, phần `diff` thay mọi `\r` bằng `␍` trước khi escape và cắt độ dài. Phần `ai_version` và `developer_version` giữ nguyên.

## Risks / Trade-offs

- [PID bị hệ điều hành dùng lại cho tiến trình khác] → `classify` báo đang chạy dù không phải. Người dùng xoá `.nightowl/classify.lock` bằng tay; thông báo lỗi nêu đường dẫn file này.
- [Tiến trình bị `kill -9` để lại khoá] → Lần chạy sau thấy PID đã chết, nên tự dọn.
- [`openExistingStoreForWrite` mở chỉ đọc để kiểm tra rồi mới mở để ghi: nếu database bị xoá đúng giữa hai lần mở, lần mở ghi sẽ tạo lại nó] → Cửa sổ rất nhỏ và chỉ xảy ra khi người dùng tự xoá `.nightowl/` trong lúc lệnh chạy. Chấp nhận.
