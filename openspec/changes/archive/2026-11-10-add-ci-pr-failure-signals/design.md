# Design

## Context

Failures hiện chỉ `manual-fix` / `ai-self-fix` từ git post-commit. Events có nguồn `claude-code`/`git` (+ agent). Action chỉ `report` + sticky comment. Product/roadmap #26 cần CI + PR signals. Xem proposal.md — Why.

Ràng buộc: không telemetry; CLI mặc định offline; không bịa `ai_content`; hook git/agent không chậm thêm (ingest là lệnh tường minh / bước CI, không gắn pre-commit).

## Goals / Non-Goals

**Goals:**
- CLI file-first: `ingest-ci`, `ingest-pr`.
- Events CI/PR trong SQLite + đếm trên `report --json`.
- Opt-in GitHub fetch comments; Action input tùy chọn cho JUnit.
- Idempotent fingerprints.

**Non-Goals:**
- Tự động scrape mọi CI vendor; dashboard SaaS.
- Đổi nghĩa head-to-head / fail-on-rate dựa trên CI (gate vẫn trên failure rate hiện có trừ khi document riêng sau).
- Parse mọi định dạng log thô (ưu tiên JUnit XML + một JSON summary tối giản).
- Tạo `failures` rows thiếu snapshot AI.

## Decisions

1. **Lưu trên `events`, không mở rộng `failures.source` CHECK trong v1**  
   Kind: `ci-fail`, `pr-review`. Source channel: `ci` / `pr` (cập nhật validation/migration; có thể nới CHECK `events` nếu đang hẹp).  
   *Alternative:* thêm `failures.source=ci-fail` — từ chối vì thiếu `ai_content` chuẩn.

2. **Fingerprint idempotent**  
   CI: hash `(commit_sha|unknown, testsuite, classname, name, file?)`. PR: `comment_id` hoặc hash `(pr, path, line, body_prefix)`. Unique index hoặc lookup-before-insert trên payload/`dedupe_key` TEXT cột mới nếu cần.

3. **Liên kết agent best-effort**  
   Nếu `file_path` có open edit / recent edit cùng commit window → ghi `agent` + `related_event_id` trong payload; không tạo failure.

4. **JUnit trước, JSON summary thứ hai**  
   `--format junit|json` hoặc detect theo extension. JSON schema tối thiểu: `{ "failures": [ { "file", "message", "name?", "commit?" } ] }`.

5. **PR: file-first; `--github` + `GITHUB_TOKEN`**  
   File schema: array comments `{ id, path, body, commit_id?, user? }` (không lưu PII thừa; trunc body). API chỉ khi `--github` và token; dùng REST list review comments cho PR number từ env `GITHUB_REPOSITORY` + `--pr <n>` hoặc `GITHUB_EVENT_PATH` khi có.

6. **Action**  
   Input `junit-path` (optional). Step: nếu set và file exists → `nightowl ingest-ci --file …` rồi report. Không thêm ingest-pr API mặc định.

7. **Report**  
   Đếm events kind CI/PR trong `--since`; JSON `signals: { ci_fail, pr_review }`. Không trộn vào `total` failures.

## Risks / Trade-offs

- [JUnit không có file path] → Mitigation: vẫn ghi sự kiện với `file_path` null; liên kết agent bỏ qua.  
- [Trùng/nhiễu CI flaky] → Mitigation: dedupe + `--since` trên report; không auto-confirm.  
- [Phạm vi GitHub API lớn] → Mitigation: tắt mặc định; chỉ PR comments, không issue body.  
- [Migration CHECK events hẹp] → Mitigation: migration nới source/kind; test migration từ DB fixture.

## Migration Plan

- Bump schema version (+1 từ hiện tại).  
- Thêm hỗ trợ kind/source mới; optional cột `dedupe_key`.  
- Rollback: revert code; DB mới hơn → NightOwl cũ báo upgrade (hành vi sẵn có).

## Open Questions

- (Không chặn) Có hỗ trợ `vitest` JSON reporter ngoài JUnit trong cùng change nếu fixture sẵn — quyết lúc apply.
