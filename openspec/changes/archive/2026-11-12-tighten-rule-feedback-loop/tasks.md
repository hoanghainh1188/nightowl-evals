# Tasks

## 1. Shared rule-impact line + dashboard

- [x] 1.1 Extract/shared `formatRuleImpactLine` (và helper lấy mark+compare nếu cần) dùng chung digest; unit test none / n/a / label+delta
- [x] 1.2 Wire dòng/section rule-impact vào dashboard HTML (cùng semantics); test HTML có/không mark

## 2. Next-step hints

- [x] 2.1 Sau `suggest-rules --write` / `--output` thành công: stderr next-step (mark → impact/digest/dashboard); test assert stderr; stdout-only không bắt buộc hint
- [x] 2.2 Sau `rule-impact mark` thành công: gợi ý xem impact/digest; test mark path

## 3. Help / README + validate

- [x] 3.1 Cập nhật `--help` suggest-rules / rule-impact (+ digest/dashboard nếu gọn) và README blurb vòng phản hồi; test help strings
- [x] 3.2 `npm test` + typecheck + `openspec validate tighten-rule-feedback-loop` xanh

## Workflow follow-up

- Archive change sau review; tick #42 trong `docs/v0.6-roadmap-ideas.md` khi archive.
