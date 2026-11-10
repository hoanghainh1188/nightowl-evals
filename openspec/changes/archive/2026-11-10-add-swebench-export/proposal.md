# Proposal

## Why

`nightowl export` chỉ có JSONL `nightowl.eval/v1`. Team muốn đưa failure local vào hệ sinh thái benchmark (SWE-bench-style harness, Promptfoo) mà không viết script chuyển đổi tay. Roadmap #23: thêm `--format swe-bench` và `--format promptfoo`.

## What Changes

- Mở rộng `nightowl export` với `--format <jsonl|swe-bench|promptfoo>` (mặc định `jsonl` — hành vi hiện tại).
- `swe-bench`: xuất JSONL (hoặc JSON array có document) các instance **tương thích trường cốt lõi** SWE-bench (`instance_id`, `repo`, `base_commit`, `problem_statement`, `patch`, `test_patch`, …) map từ failure NightOwl; trường harness không suy ra được (FAIL_TO_PASS, …) để rỗng / null và ghi chú trong docs rằng đây là **best-effort local dataset**, không phải SWE-bench official.
- `promptfoo`: xuất file cấu hình Promptfoo (YAML hoặc JSON) + (nếu cần) file prompt/vars để eval model trên `expected` vs `rejected` từ failure; không gọi mạng, không chạy Promptfoo giúp user.
- Giữ nguyên filter `--since` / `--category`, an toàn ghi file, bỏ sensitive, không tự init DB.
- README: mục export formats.

## Capabilities

### New Capabilities

- (không tách capability mới — gắn vào export hiện có)

### Modified Capabilities

- `eval-export`: thêm `--format` và hợp đồng xuất swe-bench / promptfoo (help `export` liệt kê cờ theo requirement CLI trợ giúp lệnh sẵn có)


## Impact

- `src/commands/export.ts` + module format mới dưới `src/export/` (ví dụ `swe-bench.ts`, `promptfoo.ts`).
- Tests cho mapping + CLI flag.
- Không đổi schema SQLite; không LLM; không network từ binary.
