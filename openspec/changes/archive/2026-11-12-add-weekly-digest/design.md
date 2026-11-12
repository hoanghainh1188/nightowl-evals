# Design

## Context

See `proposal.md` — Why. Đã có `buildReport` (report/dashboard), `listFailuresForReview` (flagged), `compareRuleImpact` / `getLatestRuleApplication` (rule-impact). Digest là **composition + format** mới, không schema mới.

## Goals / Non-Goals

**Goals:**
- CLI `nightowl digest` chỉ-đọc; default lookback 7 ngày UTC.
- Markdown stdout + HTML file; tái dùng số liệu report/review/impact.
- Document rõ: không auto-notify.

**Non-Goals:**
- Cron / launchd / GitHub Action gửi Slack.
- Relative parser đầy đủ ISO-8601 duration (chỉ `Nd` đơn giản nếu làm).
- So sánh eval A/B (#38) hay redaction sâu (#37).
- `--open` bắt buộc (MAY reuse `openLocalPath` nếu rẻ; không blocker).

## Decisions

1. **Composition layer `src/digest/`**
   - `buildDigest(store, { since, depth, agents, now })` → cấu trúc bất biến: totals, top categories/agents, flaggedCount, signals, ruleImpactSummary | null.
   - Gọi `buildReport` + `countEventsByKind(SIGNAL_KINDS)` + đếm flagged qua review query (limit cao hoặc count-only nếu có) + `compareRuleImpact` khi có latest application.
   - *Alternative:* shell script gọi ba lệnh — từ chối vì UX một lệnh.

2. **Cửa sổ thời gian**
   - Default: `now - 7d` → ISO start-of-day UTC (cùng `parseDateOption` semantics).
   - `--since YYYY-MM-DD` như report.
   - Thêm parse `^\d+d$` (ví dụ `7d`) → trừ N ngày; roadmap wording `digest --since 7d`. Không hỗ trợ `1w`/`1m` trong MVP.
   - *Alternative:* chỉ YYYY-MM-DD — kém khớp ideation; `Nd` nhỏ và test được.

3. **Format**
   - `--format md|html` (default `md`). `md` → stdout; `html` yêu cầu `-o/--output` hoặc default `.nightowl/digest.html`.
   - HTML: self-contained, escape như dashboard; không CDN.
   - Markdown: headings ngắn, bảng/list ASCII; printable() strip control chars.

4. **Rule-impact trong digest**
   - Nếu `getLatestRuleApplication()` null → section “Rule impact: none recorded”.
   - Else chạy compare với default window days của impact module; một dòng delta total (before→after).
   - Fail-open: lỗi compare → “n/a” + vẫn exit 0 (trừ lỗi store/config).

5. **Fail paths**
   - Chưa init / không git / since invalid → exit ≠ 0 như report.
   - Store luôn `openExistingStore` (read-only).

## Risks / Trade-offs

- [Digest lệch nhẹ vs `report` text] → Cùng `buildReport`; test golden snippets.
- [Impact window ≠ digest since] → Document: impact dùng cửa sổ before/after của rule-impact, không cắt theo `--since` digest trong MVP.
- [HTML trùng dashboard] → Digest ngắn hơn (standup); dashboard vẫn full metrics.

## Migration Plan

- Không migration. Rollback: gỡ lệnh + catalog + docs.

## Open Questions

Không có.
