# Tasks

## 1. Marker block helpers

- [x] 1.1 Thêm cặp marker start/end + helper `buildRulesBlock` / `upsertRulesBlock` / detect marker cũ hoặc cặp mới trong `src/rules/` (format/types); unit test thuần cho append, replace idempotent, và lỗi marker lệch
- [x] 1.2 Chuẩn hoá `formatSuggestedRules` (hoặc wrapper) để nội dung khối dùng cặp marker mới; giữ `isReplaceable` chấp nhận marker cũ hoặc mới

## 2. CLI suggest-rules write vs output

- [x] 2.1 Tách parse: `--write` và `--output` không còn alias; validation không dùng đồng thời; help mô tả đúng hai chế độ
- [x] 2.2 Implement `--write <path>`: đọc file (hoặc tạo mới), `upsertRulesBlock`, atomic write; symlink → lỗi; marker lệch → lỗi ( `--force` theo design hẹp)
- [x] 2.3 Giữ `--output` ghi toàn file đề xuất; `--force` trên `--output` như hiện tại; cập nhật tests command (inject CLAUDE.md, idempotent, refuse lạ, không đụng ngoài khối)

## 3. Docs và completion

- [x] 3.1 README: document `--write` vs `--output`, marker, BREAKING alias
- [x] 3.2 Xác nhận completion catalog vẫn gợi ý `--write` và `--output`; bổ sung assert test nếu thiếu

## 4. Verify

- [x] 4.1 `npm test` / typecheck / `openspec validate add-suggest-rules-write` xanh

## Workflow follow-up

- Tick roadmap #29 Done trong `openspec/project.md` / `docs/v0.4-roadmap-ideas.md` sau khi merge.
- Archive change với Sync now khi apply xong.
