# Proposal

## Why

Team đã có `suggest-rules`, `rule-impact mark/show`, và một dòng rule-impact trong `digest`, nhưng trải nghiệm còn rời lệnh: sau `--write` không gợi ý bước tiếp theo, `dashboard` chưa mirror dòng impact, help/README chưa mô tả vòng suggest → apply → mark → đo. Siết vòng phản hồi local giúp chứng minh rules cải thiện trên máy team mà không SaaS và không tự sửa repo ngoài opt-in đã có.

## What Changes

- Sau `suggest-rules --write` / `--output` thành công: in **next-step hints** trên stderr (không mạng) — ví dụ mark label, rồi `rule-impact` / `digest` / `dashboard`; **không** tự gọi mark và **không** sửa thêm file rule.
- Thống nhất **dòng/tóm tắt rule-impact** trên `digest` và `dashboard` (cùng semantics mark mới nhất / label đã document; none/n/a khi chưa có).
- Củng cố **help + README** mô tả vòng phản hồi: suggest → (opt-in write) → `rule-impact mark --label` → show / digest / dashboard; `rule-impact` help nêu liên kết với suggest/digest.
- Sau `rule-impact mark` thành công: gợi ý ngắn xem impact (`rule-impact` / digest) — vẫn offline.
- **Không BREAKING**: không đổi semantics đếm impact, CI gate, hay mặc định không ghi file của suggest-rules.
- **Out of scope**: auto-mark khi `--write`, auto-commit/push rules, LLM bắt buộc, sync cloud, email/Slack webhook, SaaS dashboard, chấm người / hiện tên developer, dependency runtime mới.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `rule-synthesis`: sau ghi file thành công SHALL in gợi ý bước tiếp (mark / impact); help nêu vòng phản hồi; vẫn không ghi file trừ `--write`/`--output`.
- `rule-impact`: help + sau mark thành công gợi ý xem impact; giữ offline / không đổi report gate.
- `local-dashboard`: HTML SHALL có dòng/section rule-impact cùng semantics với digest (none/n/a khi chưa mark).
- `weekly-digest`: bảo đảm định dạng/semantics dòng rule-impact khớp dashboard (delta khi có mark; none/n/a khi không).
- `cli`: help `suggest-rules` / `rule-impact` (và nếu cần digest/dashboard) nêu vòng phản hồi rule local.

## Impact

- Code: `src/commands/suggest-rules.ts`, `src/commands/rule-impact.ts`, `src/digest/*`, dashboard HTML builder, có thể tách helper dùng chung cho dòng rule-impact (tái dùng `compareRuleImpact` / `getLatestRuleApplication`).
- Tests: suggest-rules next-step stderr; rule-impact mark hint; dashboard HTML có rule-impact; digest regression format nếu đổi wording.
- Docs: README mục suggest-rules / rule-impact / digest / dashboard; tick ideation #42 khi archive.
- Không migration DB; không dependency mới; macOS / Linux / Windows.
