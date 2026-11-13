# Design

## Context

`failures` không có `CREATE INDEX` trong migrations hiện tại; report luôn `WHERE created_at >= ?` (+ optional agent). `events` đã có vài index. Doctor đã có readiness stats nhưng không đo latency. Constraints: local-only, không đổi semantics report, Node built-ins, macOS/Linux/Windows.

## Goals / Non-Goals

**Goals:**
- Index cho cửa sổ failures (và join check path nếu rẻ).
- Doctor timing + budget warn.
- `report --debug-timing` opt-in trên stderr.

**Non-Goals:**
- Đổi công thức `changedRate` / JSON fields.
- Auto-VACUUM theo lịch.
- Redis / remote analytics.
- Rewrite toàn bộ SQL.

## Decisions

1. **Migration mới (append-only)**  
   - `CREATE INDEX IF NOT EXISTS failures_created_at ON failures (created_at);`  
   - `CREATE INDEX IF NOT EXISTS failures_agent_created ON failures (agent, created_at);`  
   - `CREATE INDEX IF NOT EXISTS checked_edits_check_id ON checked_edits (check_id);` (hỗ trợ subquery path trong `countChecksForReport`)  
   Dùng `IF NOT EXISTS` an toàn khi re-run.

2. **Doctor budget**  
   Đo wall time của `countFailuresForReport(sinceDaysAgo(now, 30))` (hoặc null nếu muốn full — chọn **30d** để ổn định).  
   Ngưỡng mặc định: **500ms** warn (constant `REPORT_QUERY_BUDGET_MS`). Chỉ warn; `--strict` fail nếu design muốn — **mặc định: warn only** (không đổi exit của doctor trừ fail khác).

3. **`--debug-timing` trên report**  
   Đo các bước: failures query, checks query, clustering (nếu có), buildReport. In một dòng stderr dạng `nightowl report: timing: failures=Xm checks=Ym total=Zm`. Không đụng stdout.

4. **Completion + help + README**  
   Cập nhật catalog `report`, doctor help, README mục doctor/report ngắn.

## Risks / Trade-offs

- **Index làm to file DB** — chấp nhận; prune/vacuum vẫn tách.  
- **Budget 500ms phụ thuộc máy** — chỉ warn; document có thể chậm trên HDD.  
- **Doctor gọi query thêm** — một query nhẹ; OK.
