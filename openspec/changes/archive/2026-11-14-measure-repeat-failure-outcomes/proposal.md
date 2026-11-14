# Proposal

## Why

Điều kiện giai đoạn 2 trong product doc là chứng minh **tỷ lệ lỗi lặp giảm rõ**, nhưng NightOwl mới có cluster trong một cửa sổ `--since` và rule-impact theo tổng — chưa có metric first-class so fingerprint/cluster xuất hiện lại sau baseline. Team local cần số deterministic trên máy để standup/CI narrative mà không SaaS.

## What Changes

- Định nghĩa **repeat vs new** deterministic từ cùng `cluster_key` (category|module|agent|fingerprint) đã có: key xuất hiện trong cửa sổ báo cáo và đã từng xuất hiện trong cửa sổ baseline trước đó.
- Thêm object metric `repeat` (JSON snake_case) trên `report` / cùng nguồn dashboard; dòng tóm tắt trên text report, digest, dashboard HTML.
- Tuỳ chọn so hai cửa sổ rõ ràng (flag kiểu `--baseline-since` hoặc tương đương đã document); mặc định baseline hợp lý khi chỉ có `--since` (ví dụ cửa sổ liền trước cùng độ dài — chốt trong design).
- Document giới hạn: thiếu content → không fingerprint; dismissed không đếm; không tên developer.
- **Không BREAKING** các field `total` / `noise` / `clusters` / `changed_rate` hiện có (chỉ thêm field).
- **Out of scope:** sync cloud, telemetry, LLM, dashboard team hosted, đổi công thức `changedRate`, lưu bảng “repeat history” riêng nếu không cần (tính on-read).

## Capabilities

### New Capabilities

- `repeat-outcomes`: Định nghĩa và tính metric lỗi lặp (repeat/new/rate) local từ cluster key + hai cửa sổ thời gian.

### Modified Capabilities

- `failure-report`: Surface `repeat` trên text/`--json` report.
- `weekly-digest`: Thêm tóm tắt repeat trong digest.
- `local-dashboard`: Hiển thị repeat trên HTML dashboard.
- `cli`: Help mô tả metric/flag baseline liên quan.

## Impact

- Code: `src/cluster/*` (reuse key), module tính repeat mới hoặc cạnh `src/report/`, `src/commands/report.ts` / `digest.ts` / `dashboard.ts`, `src/report/format.ts`, `src/digest/*`, `src/dashboard/format.ts`, README.
- Tests: unit metric + format JSON keys + CLI report/digest/dashboard.
- Dependencies: không thêm runtime dependency.
- Hard-rule: không exception (vẫn local-only, không LLM, không chấm người).
