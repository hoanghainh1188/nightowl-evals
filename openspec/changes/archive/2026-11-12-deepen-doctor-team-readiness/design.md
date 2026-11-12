# Design

## Context

See proposal.md — Why. Hiện `src/commands/doctor.ts` đã có: runtime, git, Claude/Cursor/agent markers, git hooks (husky/lefthook/native), storage integrity/schema, stats events/failures, warn “Report readiness” khi `reportable === 0`. Chưa gọi `discoverWorkspaces`. Cursor JSON invalid đã warn. Git hook chưa kiểm tra mode executable. Signals chưa vào tóm tắt readiness.

## Goals / Non-Goals

**Goals:**

- Doctor warn khi có workspace config nhưng discovery rỗng; ok khi có ≥1 package.
- Authenticity: executable bit POSIX cho git hooks NightOwl; giữ/ củng cố parse JSON agent.
- Readiness summary: reportable failures + counts `SIGNAL_KINDS` (toàn store, `since: null`).
- Help text cập nhật; tests monorepo + hook mode + signals.
- macOS / Linux / Windows: skip execute-bit warn trên win32.

**Non-Goals:**

- Gọi mạng / API vendor để “verify hook thật sự fire”.
- Persist privacy flags trong DB (cờ privacy là CLI per-command) — không thêm check privacy giả.
- Đổi semantics `--strict` hiện có.
- SaaS / multi-machine sync.
- Dependency mới.

## Decisions

1. **Workspace check** — Gọi `discoverWorkspaces(root)` một lần trong `checkStorage` hoặc `checkWorkspace(root)`. Phát hiện “có config” bằng cùng logic đọc `package.json` workspaces / tồn tại `pnpm-workspace.yaml` (export helper nhỏ từ `src/workspace/discover.ts` hoặc đọc file nhẹ trong doctor). Warn chỉ khi config present && discovery length === 0.

2. **Authenticity** — Sau khi xác nhận hook gọi `nightowl …`, trên `process.platform !== 'win32'` dùng `fs.access`/`stat` mode `& 0o111`; thiếu → warn. Cursor invalid JSON đã có — giữ. Không require Claude settings executable.

3. **Signals summary** — Trong `checkStorage` khi DB ok: `countEventsByKind(SIGNAL_KINDS, null)`; đưa vào message stats hoặc dòng “Signals readiness: ci-fail N, …”. Không warn riêng khi signals = 0 nếu đã có reportable failures.

4. **Output** — Giữ format category/symbol hiện tại; không thêm JSON flag trong change này.

5. **Alternative rejected:** Shell-out `pnpm ls -r` — network/tool coupling.

## Risks / Trade-offs

- Glob workspace subset có thể false-warn trên layout `**` — document; cùng hạn chế #39.
- Execute-bit trên share/FS đặc biệt có thể false-warn — remedy nêu `chmod +x`.
- Đếm signals toàn store có thể lớn trên DB cũ — chấp nhận (doctor đọc local, một query).

## Migration Plan

- Không migration schema.
- Không BREAKING.
- Archive: tick #40 trong `docs/v0.6-roadmap-ideas.md`.

## Open Questions

- Có cần `--json` cho doctor? **Không trong change này.**
