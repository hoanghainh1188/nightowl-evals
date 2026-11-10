# Design

## Context

`nightowl review` đã có list/show/confirm/dismiss/reset + filter + JSON. Io hiện có `stdin.isTTY` / `stdout`. Zero runtime deps; stack Node 22+. Xem proposal — Why. Roadmap: TUI nhẹ ANSI, không thư viện ngoài.

## Goals / Non-Goals

**Goals:**
- `review -i` / `--interactive` trên TTY: duyệt, xem diff màu, mark, thoát sạch.
- Tái dùng store/filter/diff/sanitize hiện có.
- Test được phần logic (parse phím, render buffer) mà không cần terminal thật; TTY gate có mock.

**Non-Goals:**
- Không mouse, không multi-pane phức tạp, không search fuzzy v1.
- Không dependency (`blessed`, `ink`, `ink`/`react`, …).
- Không đổi schema; không LLM; không đổi hành vi non-interactive trừ help + flag parse.

## Decisions

1. **Entry: flag trên `review`, không subcommand riêng**
   - `nightowl review -i` khớp roadmap; vẫn nhận filter list.
   - Alternative: `nightowl review tui` — bỏ vì lệch docs ý tưởng 4.

2. **Kiến trúc module**
   - `src/review/tui/{session,render,keys,ansi}.ts` (+ `runInteractiveReview` exported).
   - `review.ts`: nếu `-i` → gate TTY → gọi session; else path cũ.
   - Session loop: đọc phím (raw mode), cập nhật model `{ items, index, showDiff }`, re-render full frame (clear + paint) để đơn giản.

3. **Raw input**
   - `stdin.setRawMode(true)` + `setEncoding('utf8')`; đọc chunk; map ESC `[A`/`[B`, `j`/`k` (bonus), ` ` / `\r`, `c`/`d`/`r`, `q`, Ctrl+C = thoát.
   - `finally`: `setRawMode(false)`, show cursor, newline.
   - Inject `stdin`/`stdout`/`isatty` qua deps để test.

4. **Render**
   - Header: filter tóm tắt + hints phím một dòng.
   - List: tối đa N dòng cửa sổ quanh selection (không dump 200 dòng).
   - Diff pane: tái dùng `unifiedDiff` + color `+`/`-`/` ` ; cắt theo chiều cao terminal (`process.stdout.rows` fallback cố định).
   - Sanitize nội dung failure trước khi đưa vào frame (giữ rule failure-review).

5. **Mark + refresh**
   - Gọi `setFailureStatus` như CLI; nếu filter mặc định `flagged` và vừa confirm/dismiss → bỏ khỏi list, clamp index.
   - Mở store write khi vào TUI (cần mark); nếu chỉ muốn xem — vẫn OK mở write như `confirm` path hiện tại, hoặc mở write lazy khi mark lần đầu — **chốt:** mở write khi vào `-i` (đơn giản).

6. **`--json` + `-i`**
   - Conflict cứng ở parse; không vào TUI.

## Risks / Trade-offs

- [Raw mode / Windows] → Node raw mode trên Windows console có giới hạn; document “best on macOS/Linux TTY”; test gate + logic tách.
- [Flicker full redraw] → Chấp nhận v1; viewport nhỏ.
- [Escape trong nội dung file] → Sanitize strip ESC trước render; chỉ ANSI do NightOwl thêm.
- [Test E2E TUI khó] → Unit: keys + render string; command test: non-TTY từ chối; optional scripted stdin mock.

## Migration Plan

1. Ship flag + TUI tối thiểu + tests + README.
2. Archive / sync `review-tui`, `failure-review`, `cli`.
3. Tick roadmap change 21.

## Open Questions

- Có hỗ trợ `h` help overlay trong TUI — nice-to-have, không chặn v1 (hints trên header đủ).
