# Proposal

## Why

Export `--format swe-bench` hiện luôn để `FAIL_TO_PASS` / `PASS_TO_PASS` rỗng và `test_patch` trống, dù `suggest-regressions` đã có thể ghi fixture JSON và stub vitest/jest gắn cùng eval id. Người dùng muốn harness tương thích hơn khi đã có artifact hồi quy local — vẫn không phải official SWE-bench dataset.

## What Changes

- Khi xuất swe-bench, nếu người dùng chỉ định thư mục regression (artifact từ `suggest-regressions`), export SHALL khớp instance theo eval id ổn định và điền harness khi có stub NightOwl tương ứng.
- `FAIL_TO_PASS` SHALL chứa định danh test suy ra từ stub (không bịa id khi thiếu file).
- `test_patch` SHALL là unified diff thêm stub (khi có); nếu không có stub khớp thì giữ chuỗi rỗng như hiện tại.
- `PASS_TO_PASS` vẫn rỗng (không suy ra test đang pass).
- Không có thư mục regression / không khớp file → hành vi hiện tại (harness rỗng) được giữ.
- Cập nhật README: swe-bench vẫn best-effort; harness chỉ đầy hơn khi có stub local.
- Không gọi mạng; không chạy test runner.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `eval-export`: nới requirement “harness luôn rỗng” — điền `FAIL_TO_PASS` / `test_patch` từ stub NightOwl khi có; giữ rỗng khi thiếu nguồn.

## Impact

- `src/export/swe-bench.ts`, `src/commands/export.ts` (tuỳ chọn mới, resolve harness).
- Có thể thêm helper nhỏ dưới `src/export/` (đọc stub/fixture, build `test_patch`).
- Tái dùng marker / nhận diện artifact từ `src/regressions/format.ts` (không đổi hành vi `suggest-regressions`).
- Tests: `test/export/swe-bench.test.ts`, `test/commands/export.test.ts`.
- Docs: README mục export swe-bench.
- Spec `regression-synthesis` không đổi requirement (chỉ là nguồn artifact được tiêu thụ).
