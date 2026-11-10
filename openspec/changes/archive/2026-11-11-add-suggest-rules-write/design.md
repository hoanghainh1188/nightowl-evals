# Design

## Context

See proposal.md — Why. Hiện trạng code:

- `suggest-rules`: `--write` là alias `--output`; `writeOutput` ghi atomic toàn file; `isReplaceable` cho phép đè nếu file trống hoặc chứa `RULES_MARKER` (`<!-- nightowl-suggested-rules -->`); `--force` bỏ qua kiểm tra đó.
- Help cố ý nói không sửa `CLAUDE.md` / `.cursorrules`.
- Marker đơn không đủ để inject an toàn vào giữa file rule dài.

Ràng buộc: offline; không telemetry; không đụng hook/commit; stack TS hiện có.

## Goals / Non-Goals

**Goals**

- Tách `--write` (inject khối marker) khỏi `--output` (file đề xuất độc lập).
- Idempotent cập nhật đúng một khối NightOwl trong file đích.
- Giữ nội dung ngoài khối; từ chối symlink; `--force` hẹp và đã document.

**Non-Goals**

- Tự sửa nhiều file rule cùng lúc / discover mọi đường dẫn agent rules.
- Merge thông minh từng rule section với git conflict UI.
- Đổi heuristic/LLM clustering.
- Ghi DB / schema mới.

## Decisions

1. **Cặp marker start/end cho `--write`**  
   Dùng:
   - `<!-- nightowl-suggested-rules:start -->`
   - `<!-- nightowl-suggested-rules:end -->`  
   Nội dung giữa hai dòng này là khối NightOwl (có thể vẫn chứa heading/meta).  
   *Alternative:* giữ marker đơn + thay từ marker đến EOF — từ chối vì dễ nuốt nội dung user phía sau.  
   *Alternative:* HTML comment JSON envelope — quá nặng cho CLAUDE.md.

2. **Tương thích marker cũ trên `--output`**  
   `--output` tiếp tục ghi file “suggested-rules” độc lập. Có thể giữ `RULES_MARKER` cũ ở đầu file **hoặc** chuyển file `--output` sang cùng cặp start/end; chọn **dùng cùng cặp start/end** cho cả hai chế độ để một hàm `hasRulesMarkers` / `replaceBlock` dùng chung. File `--output` cũ chỉ có marker đơn: `isReplaceable` chấp nhận marker cũ **hoặc** cặp mới; lần ghi mới chuẩn hoá sang cặp start/end.

3. **Hành vi `--write` khi chưa có marker**  
   Append `\n` + khối đầy đủ vào cuối file (tạo file mới nếu chưa tồn tại, mode `0o600` khi tạo mới; khi file đã tồn tại giữ permission hiện có nếu có thể). Không yêu cầu `--force`.

4. **Marker hỏng / lệch**  
   - Thiếu end, hoặc nhiều start/end: lỗi rõ, thoát ≠ 0.  
   - `--force` với `--write`: chỉ cho phép **thay thế từ start đầu tiên đến end cuối cùng** (hoặc cắt vùng lỗi theo quy tắc document một đường) khi phát hiện lệch nhẹ — **không** truncate cả file về chỉ còn khối NightOwl. Nếu không xác định được biên an toàn: vẫn lỗi dù có `--force`.  
   - `--force` với `--output`: giữ nghĩa hiện tại (đè cả file đích).

5. **Không dùng đồng thời `--write` và `--output`**  
   Giữ validation hiện có; thông báo tách nghĩa hai flag.

6. **Help / README / completion**  
   Cập nhật mô tả; catalog đã có flag — chỉ cần test/assert vẫn liệt kê cả hai.

7. **Module helper**  
   Thêm (hoặc mở rộng `src/rules/format.ts`) hàm thuần: `buildRulesBlock(markdownBody)`, `upsertRulesBlock(fileContent, block) → newContent`, `hasCompleteRulesBlock`. Command gọi helper rồi `writeFileAtomic`.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| **BREAKING** alias `--write`→`--output` | Ghi rõ trong help/README; `--output` vẫn là đường cũ. |
| User đặt marker tay sai | Lỗi rõ + `--force` hẹp; không im lặng đè cả file. |
| File cực lớn | Đọc/ghi cả file (đủ cho CLAUDE.md); không stream. |
| Windows line endings | Chuẩn hoá detect marker theo dòng trim; giữ nguyên newline style file khi có thể (best-effort: giữ `\n` nếu không chắc). |

## Migration Plan

- Không migration DB.
- Người dùng file `--output` cũ (marker đơn): lần ghi `--output` tiếp theo chuẩn hoá cặp start/end; vẫn `isReplaceable`.
- Không tự chạy `--write` trong `init`.

## Open Questions

- (Không chặn) Có nên default path gợi ý `CLAUDE.md` khi `--write` không đối số? → **Không** trong change này; luôn yêu cầu path tường minh.
