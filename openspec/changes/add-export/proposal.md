# Proposal

## Why

Mục tiêu của NightOwl là "mỗi lỗi thành một bài test chạy lại được". Doc chốt định dạng: mỗi lỗi = đầu vào + code đúng + tiêu chí chấm, xuất ra JSONL (MVP tuần 3). Change 9 (`add-eval-run`) sẽ đọc file này để chạy lại với 2 model và so điểm. Vì vậy change này chốt định dạng bộ test và cách xuất nó, chưa chạy gì.

## What Changes

- Lệnh `nightowl export` (đang là lệnh rỗng) ghi bộ test JSONL, mỗi dòng một bài test cho một bản ghi lỗi không bị `dismissed`:
  - đầu vào: prompt của dev (nếu có) và nội dung file **trước** commit có lỗi (lấy từ git, `<commit>^:<file>`; file mới thì để trống);
  - `rejected`: bản AI viết; `expected`: bản dev commit;
  - loại lỗi, lý do, độ tin cậy (nếu đã phân loại), mã commit, đường dẫn file;
  - tiêu chí chấm ở dạng mô tả, kiểu `reference` (đối chiếu với `expected`, không lặp lại lỗi trong `rejected`). Change 9 quyết định cách chấm điểm cụ thể.
- Mỗi dòng có trường `schema: "nightowl.eval/v1"` và `id` ổn định, để chạy lại nhiều lần vẫn so được.
- Không bao giờ xuất bản ghi của file nhạy cảm (`.env`, khoá, …); không ghi đè file không phải file xuất trước đó (trừ khi `--force`); cảnh báo nếu git không bỏ qua file đích.
- Mặc định ghi vào `.nightowl/export/evals.jsonl`: thư mục đã nằm trong `.gitignore`, nên code không vô tình bị commit. File được ghi với quyền `0600`, ghi nguyên tử, không ghi xuyên symlink.
- Tuỳ chọn: `--out <file>` (hoặc `--out -` để in ra stdout), `--since <YYYY-MM-DD>`, `--category <loại>` (lặp lại được, có thêm giá trị `unclassified`).
- In ra stderr số bài test đã ghi và đường dẫn file.
- Chưa có `.nightowl/` thì báo cần `nightowl init`, thoát 1, không tạo gì. Không gửi gì ra ngoài máy.

Ngoài phạm vi: chạy bộ test và chấm điểm (change 9), tiêu chí chấm do người dùng viết, xuất kèm ngữ cảnh nhiều file, các định dạng khác (CSV, OpenAI evals).

## Capabilities

### New Capabilities

- `eval-export`: Biến bản ghi lỗi thành bộ test JSONL có định dạng cố định, chạy lại được.

### Modified Capabilities

(không có)

## Impact

- Code: `src/commands/export.ts` (thay lệnh rỗng), thư mục mới `src/export/` (dựng bài test, đọc file trước commit từ git), `src/storage/` (đọc bản ghi lỗi để xuất). Xoá `src/commands/not-implemented.ts` khi cả `report` và `export` đã có.
- Không đổi schema. Không thêm dependency.
- Định dạng `nightowl.eval/v1` là giao kèo với change 9; đổi về sau phải tăng phiên bản.
