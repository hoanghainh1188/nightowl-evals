# Proposal

## Why

`suggest-rules` đã sinh Markdown đề xuất (heuristic / LLM opt-in) và ghi file riêng qua `--output`, nhưng `--write` hiện chỉ là alias của `--output` — vẫn không đưa rule vào `CLAUDE.md` / `.cursorrules` một cách an toàn. Team cần đóng vòng “đề xuất → dán vào file rule dự án” mà không đè nội dung người dùng ngoài vùng NightOwl đã đánh dấu (roadmap #29).

## What Changes

- Tách hành vi `--write <path>` khỏi `--output <path>`:
  - `--output`: ghi **toàn bộ** tài liệu đề xuất NightOwl (như hiện tại, có marker).
  - `--write`: **chèn hoặc cập nhật** một khối đề xuất giới hạn bởi marker NightOwl bên trong file rule dự án (ví dụ `CLAUDE.md`, `.cursorrules`), không sửa phần ngoài khối.
- Bổ sung marker bắt đầu/kết thúc (hoặc tương đương đã document) để thay thế idempotent vùng NightOwl.
- Làm rõ `--force`: chỉ nới điều kiện an toàn đã document (ví dụ file đã có marker lỗi/không khớp); không dùng `--force` để ghi đè tùy tiện toàn bộ file rule người dùng khi `--write`.
- Cập nhật help / README / completion cho đúng semantics mới.
- **BREAKING** (nhẹ): script/user đang dùng `--write` như alias `--output` sẽ nhận hành vi inject-marker thay vì replace toàn file — họ phải chuyển sang `--output` nếu muốn file đề xuất độc lập.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `rule-synthesis`: Phân biệt `--output` vs `--write`; yêu cầu ghi an toàn theo vùng marker; cập nhật kịch bản không đè nội dung ngoài marker.
- `cli`: Help `suggest-rules` mô tả đúng `--write` (inject marker) và mặc định vẫn không sửa file rule trừ khi có cờ tường minh.
- `shell-completion`: Catalog/gợi ý phản ánh `--write` không còn là alias thuần của `--output` (vẫn gợi ý `--write`, `--output`, `--force`).

## Impact

- Code: `src/commands/suggest-rules.ts`, `src/rules/format.ts` / `types.ts` (marker), có thể helper merge marker mới; tests `test/commands/suggest-rules.test.ts`; `src/completion/catalog.ts`; README.
- Không schema DB, không mạng, không đổi hook/commit path.
- Không bắt buộc đổi `rule-impact` / report.
