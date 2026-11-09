# Proposal

## Why

Điểm `eval` hiện chỉ so dòng (coverage × repeat) nên một bản sửa khác với `expected` nhưng vẫn đúng theo test suite của dự án bị chấm thấp. Cần thêm lớp xác minh bằng lệnh kiểm thử thật (`npm test`, `pytest`, …) để đo độ chính xác khách quan hơn trên chính codebase.

## What Changes

- Thêm tuỳ chọn opt-in cho `nightowl eval` để sau mỗi lần model trả file, NightOwl ghi nội dung đó vào đúng đường dẫn trong project (có backup/restore an toàn), chạy một lệnh test do người dùng chỉ định, rồi ghi kết quả thoát/mã lỗi vào báo cáo và JSONL.
- Giữ nguyên điểm textual hiện tại; bổ sung trường kết quả execution (pass/fail theo exit code) và tuỳ chọn yêu cầu test pass để tính `pass` tổng.
- Dry-run không có `--yes` SHALL liệt kê lệnh test sẽ chạy; không chạy model và không chạy test.
- Không thêm dependency runtime mới; timeout và tuần tự hoá khi bật test runner để tránh đụng file.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `eval-run`: mở rộng `nightowl eval` với execution verifier (lệnh test, timeout, ghi kết quả, ảnh hưởng pass/fail khi được yêu cầu)

## Impact

- `src/commands/eval.ts`, module mới dưới `src/eval/` (chạy lệnh + backup file), help/README, test `test/commands/eval*` và e2e liên quan.
- Không đổi schema SQLite; chỉ mở rộng dòng JSONL trong `.nightowl/runs/`.
- Lệnh test do người dùng cung cấp có thể tự gọi mạng — NightOwl không thêm telemetry; vẫn chỉ chạy khi opt-in rõ ràng (`--yes` + `--test-command`).
