# Design

## Context

Xem proposal.md. Hành vi: `specs/cli`.

Hiện tại `src/cli/run.ts` chỉ đọc cờ chung (`--help`, `--version`) đứng trước tên lệnh. Mọi tham số sau tên lệnh được chuyển nguyên cho `command.run(args, io)`. Mỗi lệnh tự đọc tham số:
- `report`, `export`, `classify`, `eval`: `parseArgs` với `strict: true`, nên `--help` bị coi là tuỳ chọn lạ.
- `init`, `failures`: bỏ qua `args`.
- `log`, `precommit`, `postcommit`: bỏ qua `args`, và luôn thoát 0, không in gì.

## Goals / Non-Goals

**Goals:**
- `--help` không bao giờ làm thay đổi file, database hay gửi dữ liệu, với bất kỳ lệnh nào.
- Viết logic chặn `--help` ở một chỗ, không lặp lại trong từng lệnh.

**Non-Goals:**
- Sinh trợ giúp tự động từ cấu hình `parseArgs`. Mỗi lệnh có ít tuỳ chọn, viết tay dễ đọc hơn.

## Decisions

### 1. Chặn `--help` trong `run.ts`, trước khi gọi lệnh
`run.ts` tìm `-h` hoặc `--help` trong phần tham số sau tên lệnh. Nếu có, nó in `command.help` và trả về 0, không gọi `command.run`.

Chặn ở đây (thay vì trong từng lệnh) để không lệnh nào quên được, và để lệnh mới chỉ cần khai báo nội dung trợ giúp. Nếu `--help` đứng làm giá trị của một tuỳ chọn khác (ví dụ `--out --help`), trợ giúp vẫn thắng. Trường hợp đó không có nghĩa thực tế, và in trợ giúp thì an toàn hơn chạy lệnh.

### 2. Trường `help` trong `Command`
`Command` thêm `readonly help: string`: toàn bộ văn bản trợ giúp, kết thúc bằng xuống dòng. Mẫu:

```
Usage: nightowl eval [options]

Re-run the exported suite with Claude models and compare scores.
Sends file content to Claude only with --yes.

Options:
  --yes             Actually call Claude (default: dry run)
  --input <file>    Suite to run (default: .nightowl/export/evals.jsonl)
  --model <name>    Model to compare; repeatable (default: haiku, sonnet)
  --limit <1-100>   At most this many cases (default: 20)
  -h, --help        Show this help
```

Giá trị mặc định lấy từ hằng số đã có (ví dụ `DEFAULT_EVAL_LIMIT`), không viết cứng lần hai.

Lệnh hook ghi rõ "Called by the … hook; you do not run it yourself."

### 3. `nightowl help [lệnh]`
`help` không phải một `Command` thật: `run.ts` xử lý nó trước khi tìm lệnh. `help` không đứng trong danh sách lệnh đăng ký, nên nó không hiện trong bảng lệnh của hướng dẫn chung. Nếu tên lệnh không tồn tại, `run.ts` báo lỗi giống như khi gõ sai tên lệnh và thoát 1.

### 4. `init` và `failures` từ chối tham số
Hai lệnh này gọi `parseArgs` với `options: {}`, `strict: true`, `allowPositionals: false`. Khi `parseArgs` báo lỗi, lệnh in `nightowl <lệnh>: <thông báo>` cùng dòng gợi ý `Run 'nightowl <lệnh> --help'.` rồi thoát 1, trước khi đọc hay ghi bất cứ thứ gì.

### 5. Hook giữ nguyên
`log`, `precommit`, `postcommit` vẫn bỏ qua tham số lạ. Chỉ `--help` được xử lý, và chỉ ở `run.ts`. Hook thật không bao giờ truyền `--help`: lệnh hook do `nightowl init` ghi ra cố định là `nightowl log`, `nightowl precommit`, `nightowl postcommit`.

## Risks / Trade-offs

- [Nội dung trợ giúp lệch với tuỳ chọn thật] → Test cho từng lệnh có tuỳ chọn: mọi tên tuỳ chọn trong `parseArgs` phải xuất hiện trong `help`.
- [Một hook tương lai cần nhận `--help` như dữ liệu] → Không có trường hợp nào hiện tại. Nếu có, lệnh đó sẽ đọc dữ liệu từ stdin, không từ tham số.
