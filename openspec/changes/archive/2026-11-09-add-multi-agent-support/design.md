# Design

## Context

Events hiện `source ∈ {claude-code,git}`; failures có `source ∈ {manual-fix,ai-self-fix}` (nghĩa khác). Hook chỉ Claude Code settings. Xem proposal — Why. Phạm vi C: đủ agent roadmap + git fallback + head-to-head.

## Goals / Non-Goals

**Goals:**
- Adapter pattern: mỗi agent → `NormalizedEvent` → SQLite.
- Schema `events.agent` / `failures.agent` + migration.
- `init`/`uninstall` đa agent; report đối đầu; fallback git không bịa AI content.

**Non-Goals:**
- Không patch binary IDE; chỉ hook/config công khai.
- Không MCP server bắt buộc cho v1 (có thể ghi chú extension sau).
- Không đổi công thức textual score của `eval`.

## Decisions

1. **Tách `agent` khỏi `events.source` và `failures.source`**
   - Giữ `failures.source` = manual-fix | ai-self-fix.
   - Thêm `agent` cho “trợ lý nào viết”.
   - `events.source` có thể giữ `claude-code`|`git` **hoặc** nới thành `agent-hook`|`git`; khuyến nghị: `source` = kênh (`agent-hook`|`git`), `agent` = id trợ lý. Migration map `claude-code` → source `agent-hook` + agent `claude-code`.

2. **`nightowl log` multiplex**
   - Detect payload: Claude `hook_event_name` vs Cursor `hook_event_name`/`conversation_id` vs flag `--agent <id>` khi stdin generic.
   - Module `src/agents/<id>.ts` export `parse(stdin): NormalizedEvent | null`.

3. **Cursor first among equals in implementation order**
   - Spec yêu cầu đủ adapter; tasks làm Cursor hoàn chỉnh trước, rồi Windsurf/Cline/Roo/Copilot/Aider theo cùng interface (có thể mỏng hơn nếu hook API nghèo).

4. **Git fallback**
   - Chỉ quan sát + metrics `unattributed_changes`; không tạo failure đủ cặp AI/final nếu thiếu snapshot.
   - Pattern nhánh: cấu hình trong `.nightowl/agents.json` hoặc convention document (ví dụ `cursor/*`).

5. **Head-to-head**
   - Đếm edits checked per agent tại precommit + failures per agent; % = failures/edits (cùng semantics report hiện tại, slice theo agent).

6. **Init flags**
   - `--agents cursor,claude-code,...` default all known; skip với warning nếu không ghi được file config.

## Risks / Trade-offs

- [Hook API agent thay đổi] → Pin phiên bản doc; adapter isolate; test fixture JSON.
- [Copilot Workspace / Aider hook kém ổn định] → Adapter “best effort” + doc giới hạn; vẫn đạt “có adapter + init path”.
- [Migration breaking readers ngoài] → Chỉ NightOwl đọc DB; bump schema version.
- [Nhầm agent khi nhiều tool sửa một file] → Matching theo session + thời gian + agent trên edit event.

## Migration Plan

1. Ship schema migration + Claude path tương thích.
2. Cursor ingest + report by agent.
3. Remaining agents.
4. Git fallback + head-to-head polish.
5. Archive / sync specs; README bảng hỗ trợ.

## Open Questions

- Pattern nhánh mặc định cho từng agent (chốt khi apply Cursor + doc).
- Copilot Workspace: dùng hook nào ổn định trên macOS/Linux — xác minh khi implement adapter đó.
