# Design

## Context

See proposal.md — Why. Hiện trạng quan sát được:

- `suggest-rules` ghi `--write`/`--output` rồi chỉ log “wrote/updated …”; không gợi ý mark.
- `rule-impact mark/show` và `compareRuleImpact` đã ổn; digest đã có `ruleImpactLine` (`src/digest/format.ts`); dashboard HTML (`src/dashboard/format.ts`) chưa mirror dòng đó.
- `ruleAppliedNote` chỉ phục vụ eval A/B, không phải digest/dashboard.

## Goals / Non-Goals

**Goals:**

- Next-step stderr sau suggest ghi file và sau mark thành công.
- Một helper format/tóm tắt rule-impact dùng chung digest + dashboard (cùng wording).
- Help/README mô tả vòng phản hồi; tests cover hints + HTML section.
- macOS / Linux / Windows (path/`printable` như hiện tại).

**Non-Goals:**

- Auto-mark, auto-commit rules, LLM bắt buộc.
- Đổi công thức cửa sổ before/after của `rule-impact`.
- Thêm flag mới (trừ khi bắt buộc cho help — ưu tiên không thêm flag).
- Dependency runtime mới; migration schema.

## Decisions

1. **Next-step hints là stderr copy** — Hàm nhỏ `printRuleLoopNextSteps(kind, io)` (hoặc tương đương) gọi sau ghi suggest và sau mark. Nội dung cố định/document: `nightowl rule-impact mark --label <id>` (user tự chọn id), rồi `nightowl rule-impact` / `digest` / `dashboard`. Không đọc nội dung rule file để suy label (tránh heuristic sai).

2. **Shared rule-impact summary** — Tách (hoặc export) logic dựng `{ label, before, after, delta } | null | 'unavailable'` từ digest build; dashboard gọi cùng đường khi đã có `Report`/store trong `createDashboardCommand`. Format string một chỗ (ví dụ `formatRuleImpactLine`) để digest MD/HTML và dashboard HTML khớp.

3. **Dashboard placement** — Thêm một `<section>` hoặc list item gần Signals / summary (không card layout mới phức tạp); chỉ text tĩnh self-contained như các section hiện có.

4. **Help** — Cập nhật description arrays trong `suggest-rules` / `rule-impact` (+ digest/dashboard một câu nếu gọn); README blurb vòng phản hồi ngắn.

5. **Alternatives rejected:**
   - Subcommand mới `nightowl rules loop` — dư bề mặt; glue lệnh hiện có đủ.
   - Auto-infer label từ cluster id trong suggest — dễ lệch với label người dùng chọn khi mark; giữ label thủ công.

## Risks / Trade-offs

- [Stderr nhiễu] → Giữ 2–4 dòng ngắn; chỉ khi ghi file / mark thành công.
- [Wording digest đổi nhẹ] → Test snapshot/string assert cập nhật; semantics đếm không đổi.
- [Dashboard cần mở store thêm cho impact] → Tái dùng store đã mở trong command; không mở lần hai nếu tránh được.

## Migration Plan

- Không migration DB; không BREAKING.
- Archive: tick #42 trong `docs/v0.6-roadmap-ideas.md`.

## Open Questions

- Có cần gợi ý label mẫu (ví dụ `convention-<module>`) trong stderr không? **Không trong change này** — chỉ nhắc `--label <id>`.
