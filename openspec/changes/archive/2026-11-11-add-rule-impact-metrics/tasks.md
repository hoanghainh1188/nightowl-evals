# Tasks

## 1. Schema và store

- [x] 1.1 Migration: bảng `rule_applications` (label, applied_at, filters JSON, baseline JSON) + index; verify migration từ DB cũ
- [x] 1.2 API store: upsert theo label, get latest / by id|label, list tối thiểu cho show; verify unit test

## 2. Đếm cửa sổ và mark

- [x] 2.1 Helper đếm failure non-dismissed theo filter + khoảng thời điểm (module depth như report); verify unit
- [x] 2.2 `rule-impact mark`: snapshot baseline, upsert label, chưa init → lỗi; verify command test

## 3. Show / so sánh

- [x] 3.1 So sánh before/after (mặc định 14 ngày, cờ override, `after_incomplete`); text + `--json`; không bản ghi → lỗi; verify
- [x] 3.2 Đăng ký CLI + help; completion catalog; verify help/completion có `rule-impact`

## 4. Docs và kiểm tra

- [x] 4.1 README: mark → áp rule thủ công → show; không mạng/LLM; không đổi `report` gate
- [x] 4.2 `npm test` / typecheck / `openspec validate add-rule-impact-metrics` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick roadmap #27 Done trong `openspec/project.md` / `docs/v0.4-roadmap-ideas.md`.
