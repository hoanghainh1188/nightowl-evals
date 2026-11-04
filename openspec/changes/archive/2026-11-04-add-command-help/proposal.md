# Proposal

## Why

Khi viết README, tôi chạy `nightowl init --help` để xem trợ giúp. Lệnh bỏ qua `--help` và cài NightOwl thật vào repo: tạo `.claude/settings.json`, hai git hook và `.nightowl/`. Người dùng hỏi "lệnh này làm gì?" thì không được phép bị thay đổi repo.

Cùng lúc đó:
- `report`, `export`, `classify`, `eval` gặp `--help` thì báo `Unknown option '--help'` và thoát 1. Người dùng không xem được tuỳ chọn của từng lệnh nếu không đọc README.
- `init` và `failures` nhận mọi tham số lạ mà không báo gì, nên gõ sai cũng không biết.
- Spec `cli` còn requirement "Lệnh con chưa triển khai" từ tuần 1, trong khi `report` và `export` đã có logic từ tuần 3.

## What Changes

- `nightowl <lệnh> --help` (hoặc `-h`) in trợ giúp của lệnh đó ra stdout rồi thoát 0, và **không chạy lệnh**. Trợ giúp gồm cách gọi, mô tả, các tuỳ chọn với giá trị mặc định. Áp dụng cho mọi lệnh, kể cả `log`, `precommit`, `postcommit`.
- `nightowl help <lệnh>` cho cùng kết quả. `nightowl help` không kèm tên lệnh thì giống `nightowl --help`.
- `init` và `failures` không nhận tham số nào. Có tham số thì báo lỗi ra stderr, gợi ý `--help`, thoát 1, không thay đổi gì.
- `log`, `precommit`, `postcommit` giữ nguyên: tham số lạ vẫn bị bỏ qua, thoát 0, không in gì, vì hook không bao giờ được chặn Claude Code hay git commit.
- Hướng dẫn chung (`nightowl --help`) thêm dòng `Run 'nightowl <command> --help' for its options.`
- Xoá requirement "Lệnh con chưa triển khai" khỏi spec `cli`.

Ngoài phạm vi:
- `nightowl failures` vẫn tạo `.nightowl/` khi chạy trong repo chưa `init`. Cần change riêng.
- Trợ giúp song ngữ hoặc trang `man`.

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `cli`: thêm trợ giúp cho từng lệnh, thêm `nightowl help`, từ chối tham số lạ ở `init` và `failures`, xoá requirement đã lỗi thời.

## Impact

- Code:
  - `src/commands/command.ts`: thêm trường `help`.
  - `src/cli/run.ts`: chặn `--help` trước khi gọi lệnh.
  - `src/cli/help.ts`: thêm dòng gợi ý.
  - `src/commands/*.ts`: viết nội dung trợ giúp cho từng lệnh; `init.ts` và `failures.ts` kiểm tra tham số.
- README: thêm một dòng về `nightowl <command> --help`.
- Không đổi schema, không thêm dependency, không truy cập mạng.
