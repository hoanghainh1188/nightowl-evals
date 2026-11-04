# Tasks

## 1. Chặn --help ở run.ts

- [x] 1.1 Thêm trường `help` vào `Command`; viết test cho `run.ts`: `<lệnh> --help` và `-h` in `command.help`, thoát 0, không gọi `command.run` (kể cả khi `--help` đứng sau tuỳ chọn khác); cài để pass
- [x] 1.2 Viết test cho `nightowl help`, `nightowl help <lệnh>`, `nightowl help <lệnh sai>`, và dòng gợi ý trong hướng dẫn chung; cài trong `run.ts` và `help.ts` để pass

## 2. Nội dung trợ giúp

- [x] 2.1 Viết `help` cho `report`, `export`, `classify`, `eval`, dùng hằng số mặc định đã có; test: mọi tuỳ chọn khai báo trong `parseArgs` của lệnh đều xuất hiện trong `help`
- [x] 2.2 Viết `help` cho `init`, `failures`, `log`, `precommit`, `postcommit`; lệnh hook nêu rõ do hook gọi

## 3. Từ chối tham số lạ

- [x] 3.1 Viết test: `init --force` và `failures all` báo lỗi, thoát 1, không tạo file; cài `parseArgs` rỗng trong `init.ts` và `failures.ts` để pass
- [x] 3.2 Viết test: `log`, `precommit`, `postcommit` với tham số lạ vẫn thoát 0, không in gì

## 4. Kiểm tra đầu cuối

- [x] 4.1 Test e2e với bin thật trong repo git tạm: `nightowl init --help` không tạo `.claude/`, `.nightowl/` hay git hook; `nightowl eval --help` không gọi `claude`
- [x] 4.2 Thêm dòng `nightowl <command> --help` vào README
- [x] 4.3 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
