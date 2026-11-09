# Tasks

## 1. Parse options và module chạy test

- [x] 1.1 Thêm `--test-command`, `--test-timeout`, `--require-tests` vào parse options của `eval` (validate khoảng timeout, từ chối `--require-tests` thiếu `--test-command`) và verify unit test parse/reject tương ứng pass
- [x] 1.2 Tạo helper backup/ghi/restore file + spawn shell có timeout/huỷ cross-platform; verify unit test restore sau success/fail/timeout và không để lại nội dung model

## 2. Gắn vào vòng eval

- [x] 2.1 Dry-run in lệnh test / timeout / require-tests trên stdout khi có flag; verify test dry-run không spawn model hay shell
- [x] 2.2 Sau đầu ra model hợp lệ: tuần tự backup → ghi → chạy test → restore; ghi `tests_passed` / `tests_exit_code` / `tests_error` vào kết quả; verify test với fake runner
- [x] 2.3 Áp dụng `--require-tests` lên `pass`; cập nhật bảng stdout/JSONL; verify scenario textual pass + test fail → `pass` false

## 3. Tài liệu và kiểm tra tích hợp

- [x] 3.1 Cập nhật help `nightowl eval` và README (ví dụ `--test-command`); verify `nightowl eval --help` hiện các flag mới
- [x] 3.2 Chạy `npm test` / typecheck liên quan eval và verify suite xanh

## Workflow follow-up

- Archive change sau khi Harry duyệt và merge.
- Tick trạng thái P2 `add-eval-test-runner` trong `docs/production-readiness.md` khi archive/sync specs.
