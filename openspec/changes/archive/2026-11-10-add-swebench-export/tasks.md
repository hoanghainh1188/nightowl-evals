# Tasks

## 1. CLI `--format` và đường dẫn mặc định

- [x] 1.1 Parse `--format jsonl|swe-bench|promptfoo` (default `jsonl`); lỗi giá trị lạ; verify command test
- [x] 1.2 Default `--out` theo format (`evals.jsonl` / `swe-bench.jsonl` / `promptfooconfig.yaml`); help liệt kê `--format`; verify help + path test

## 2. Writers SWE-bench và Promptfoo

- [x] 2.1 Module map failure → SWE-bench-compatible instance (diff patch, repo/base_commit best-effort); verify unit test fixture
- [x] 2.2 Module emit Promptfoo YAML (prompts/providers/tests + equals expected); verify unit test cấu trúc + không mạng
- [x] 2.3 Wire `export` chạy writer theo format, tái dùng filter/sensitive/atomic write; verify integration command test

## 3. Docs và kiểm tra tổng

- [x] 3.1 README: `--format swe-bench` / `promptfoo`, lưu ý best-effort / không phải official SWE-bench; verify chuỗi docs
- [x] 3.2 `npm test` / typecheck / `openspec validate` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick change 23 trong `openspec/project.md` / `docs/v0.3-roadmap-ideas.md`.
