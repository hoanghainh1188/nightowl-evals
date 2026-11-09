# Tasks

## 1. Schema và mô hình agent

- [x] 1.1 Thêm migration: cột `agent` trên `events`/`failures`, map dữ liệu cũ `claude-code`; verify test migration + đọc/ghi
- [x] 1.2 Định nghĩa registry agent ids + `NormalizedEvent`; verify unit test reject id lạ

## 2. Ingest multiplex và Claude tương thích

- [x] 2.1 Refactor `nightowl log` detect payload → adapter; giữ hành vi Claude Code; verify test Claude hiện có vẫn xanh
- [x] 2.2 Adapter Cursor (`beforeSubmitPrompt` / `afterFileEdit`) ghi prompt/edit; verify fixture JSON Cursor

## 3. Init / uninstall đa agent

- [x] 3.1 `init --agents` cài Cursor hooks idempotent + giữ Claude; verify test init/uninstall Cursor
- [x] 3.2 Cài/gỡ stub-or-full config cho Windsurf, Cline, Roo, Copilot Workspace, Aider theo registry; verify mỗi agent có test “init thêm được entry NightOwl” (fixture)

## 4. Adapters agent còn lại

- [x] 4.1 Implement parse/normalize cho Windsurf, Cline, Roo, Copilot Workspace, Aider (best-effort theo hook/CLI từng tool); verify mỗi adapter có ≥1 fixture → NormalizedEvent
- [x] 4.2 Failure matching ưu tiên đúng `agent` khi nhiều edit cùng file; verify test không nhầm agent

## 5. Git fallback

- [x] 5.1 Pre/post-commit: khi thiếu snapshot, ghi quan sát fallback (không bịa `ai_content`); verify test không tạo failure đủ cặp
- [x] 5.2 Heuristic nhánh → agent metadata; verify pattern document + test

## 6. Report / review đối đầu

- [x] 6.1 `report` text + `--json`: `by_agent`, `head_to_head`, `--agent`; verify unit/e2e report
- [x] 6.2 `review --agent`; verify filter

## 7. Docs và kiểm tra tổng

- [x] 7.1 README: bảng agent, giới hạn fallback, ví dụ init; verify help flags
- [x] 7.2 `npm test` / typecheck / `openspec validate` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Cập nhật `docs/v0.3-roadmap-ideas.md` / `openspec/project.md` tick change 18.
