# Tasks

## 1. Resolve harness từ thư mục regression

- [x] 1.1 Thêm helper đọc stub NightOwl theo `instance_id` trong `--regressions-dir` (marker + tên `{id}.test.ts`); verify unit test: khớp / bỏ file lạ / chỉ JSON → không điền
- [x] 1.2 Build `FAIL_TO_PASS` (relative POSIX path) và `test_patch` (unified diff thêm stub); verify unit test trên `toSweBenchInstance` (hoặc wrapper) khi có/không harness

## 2. Wire vào `export --format swe-bench`

- [x] 2.1 Parse `--regressions-dir`; validate tồn tại & là thư mục (lỗi stderr, exit ≠ 0, không ghi file); verify command test path invalid
- [x] 2.2 Không flag → harness rỗng như cũ; có flag + stub khớp → fields đầy; verify `test/commands/export.test.ts`
- [x] 2.3 Help/completion liệt kê `--regressions-dir` cho export; verify help text + catalog (nếu có) chứa flag

## 3. Docs

- [x] 3.1 README: swe-bench vẫn best-effort; mô tả `--regressions-dir` + điều kiện stub từ `suggest-regressions`; verify chuỗi docs khớp help
