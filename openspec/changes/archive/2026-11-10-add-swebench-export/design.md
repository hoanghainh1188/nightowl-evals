# Design

## Context

`nightowl export` đã có JSONL `nightowl.eval/v1`, filter, sensitive skip, atomic write. Roadmap #23: thêm format SWE-bench-like và Promptfoo. Binary không mạng. Xem proposal — Why.

## Goals / Non-Goals

**Goals:**
- `--format jsonl|swe-bench|promptfoo` với default `jsonl` không đổi hành vi.
- Mapping best-effort từ failure → SWE-bench core fields và Promptfoo YAML.
- Tái dùng list/filter/sensitive/`file_before` hiện có.

**Non-Goals:**
- Không chạy SWE-bench harness / Promptfoo / Docker.
- Không giả lập FAIL_TO_PASS thật từ test suite dự án (v1 để rỗng).
- Không upload HuggingFace / không đổi `nightowl eval`.

## Decisions

1. **Flag `--format`, không subcommand riêng**
   - Khớp roadmap; một pipeline filter → serialize.
   - Alternative: `export swe-bench` — bỏ để giữ một entry.

2. **SWE-bench = JSONL một instance / dòng**
   - Dễ nối `jq` / HF datasets; default path `.nightowl/export/swe-bench.jsonl`.
   - Schema document là **NightOwl SWE-bench-compatible v1** (không claim official).
   - Mapping:
     - `instance_id`: tái dùng `evalId` (ổn định).
     - `repo`: `git remote get-url origin` parse `owner/repo` nếu được; else basename root.
     - `base_commit`: parent của `commit_sha` nếu có (HEAD trước fix), else `commit_sha`, else `null`.
     - `problem_statement`: ghép prompt / category / file_path / feedback (không gửi mạng).
     - `patch`: unified diff `file_before ?? rejected` → `expected` (một file path).
     - `test_patch`: `""` v1 (hoặc diff rỗng); không suy từ regressions trừ khi đã có sẵn và opt-in sau.
     - `FAIL_TO_PASS` / `PASS_TO_PASS`: `[]`.
     - `created_at`: từ failure.
     - `hints_text`: feedback hoặc `""`.
     - `version` / `environment_setup_commit`: `""` / `null`.

3. **Promptfoo = một YAML**
   - Default `.nightowl/export/promptfooconfig.yaml`.
   - `prompts`: template có `{{file_path}}`, `{{file_before}}`, hướng dẫn sửa defect (không nhét `expected` vào prompt).
   - `providers`: placeholder `echo` hoặc comment `openai:…` — **chốt:** `providers: [echo]` hoặc chuỗi hướng dẫn trong comment YAML + `providers: []` invalid — dùng `providers: [{ id: 'file:///dev/null' }]` xấu. **Chốt:** `providers: ['echo']` documented “thay bằng model của bạn”.
   - `tests[]`: vars từ failure; assert `equals` với `expected` (cắt nếu quá lớn? — **chốt:** full expected; file mode 0600).
   - Không dependency `js-yaml` nếu tránh được: emit YAML bằng template string cẩn thận escape; hoặc thêm dev-only — **chốt:** hand-roll minimal YAML escape (string block `|`) zero deps.

4. **Unified diff helper**
   - Tái dùng / mở rộng diff hiện có (classify hoặc review) thay vì thêm `diff` package.
   - Nếu không có library: simple line diff đủ cho single-file patch header `--- a/path` `+++ b/path`.

5. **CLI wiring**
   - `parseOptions` thêm `format`; default paths theo format khi `out` null.
   - stderr summary: `Exported N cases (format=…) to path`.

## Risks / Trade-offs

- [Không phải SWE-bench official] → Docs rõ “compatible fields”; empty harness fields.
- [Promptfoo equals quá cứng với expected dài] → Document; user có thể sửa assert.
- [YAML escape] → Prefer literal block scalars; test round-trip parse nhẹ bằng regex/structure checks (không bắt buộc full YAML lib).
- [base_commit sai nếu commit rewrite] → Best-effort; null khi không resolve.

## Migration Plan

1. Ship `--format` + writers + tests + README.
2. Archive / sync `eval-export`.
3. Tick roadmap 23.

## Open Questions

- Không còn câu hỏi chặn.
