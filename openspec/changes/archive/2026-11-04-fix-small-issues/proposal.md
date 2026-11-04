# Proposal

## Why

Các review trước để lại vài lỗi nhỏ chưa sửa. Trong lúc chờ dữ liệu thật từ `aegis-code`, sửa chúng cho gọn:

1. **`nightowl failures` và `nightowl classify` tự tạo `.nightowl/`** khi chạy trong repo chưa `nightowl init`, và tự nâng schema của database cũ. Các lệnh khác (`report`, `export`, `eval`, `review`) đã không làm vậy. Chạy nhầm thư mục thì repo đó có thêm một `.nightowl/` rỗng, chưa nằm trong `.gitignore`.
2. **Hai lệnh `classify --yes` chạy cùng lúc** đọc cùng danh sách lỗi chưa phân loại, nên gửi cùng một lỗi cho Claude hai lần: tốn tiền gấp đôi, và kết quả sau ghi đè kết quả trước.
3. **Diff gửi cho `classify` giấu ký tự `\r`.** Khi AI viết xuống dòng CRLF và dev lưu lại LF, mọi dòng đều khác nhau nhưng trông y hệt nhau. LLM thấy một diff vô nghĩa, dễ phân loại sai.

## What Changes

- **Không tự khởi tạo.** `failures` mở database chỉ đọc. `classify` kiểm tra database đã có và đúng phiên bản trước khi mở để ghi, giống `review`.
  - Thiếu `.nightowl/` thì cả hai báo chạy `nightowl init` và thoát mã 1, không tạo gì.
  - Database cũ cũng báo chạy `nightowl init`, không tự nâng schema.
- **Mỗi lúc chỉ một `classify --yes`.**
  - Lệnh tạo file khoá `.nightowl/classify.lock` (chế độ 0600, ghi PID) trước khi gọi Claude, và xoá nó khi xong, kể cả khi lỗi.
  - Có khoá của một tiến trình còn sống thì lệnh báo "another classify is running (pid N)", thoát mã 1, không gửi gì.
  - Khoá của tiến trình đã chết (bị kill, máy khởi động lại) được coi là cũ: xoá đi rồi chạy tiếp.
  - Chạy thử (không có `--yes`) không cần khoá.
- **`\r` hiện ra trong diff gửi LLM**, dạng `␍`, để thay đổi chỉ ở xuống dòng nhìn thấy được. Nội dung file đầy đủ và database không đổi.

Ngoài phạm vi:
- Khoá cho `eval` (không ghi database, chạy song song chỉ tốn thêm tiền mà người dùng đã đồng ý).
- Chuẩn hoá CRLF khi phát hiện lỗi ở hook.

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `failure-records`: `failures` chỉ đọc, không tự khởi tạo.
- `failure-classification`: không tự khởi tạo, khoá một lần chạy, `\r` trong diff.

## Impact

- Code:
  - `src/commands/failures.ts`, `src/commands/classify.ts`.
  - `src/commands/existing-store.ts`: thêm hàm mở để ghi chỉ khi database đã có và đúng phiên bản, chuyển từ `review.ts` sang.
  - File mới `src/classify/lock.ts`.
  - `src/classify/prompt.ts`.
- Không đổi schema, không thêm dependency.
