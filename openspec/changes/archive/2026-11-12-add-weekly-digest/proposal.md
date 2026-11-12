# Proposal

## Why

Team standup / weekly cần **một trang tóm tắt** từ dữ liệu NightOwl local thay vì chạy lần lượt `report`, `review`, `rule-impact`. Product roadmap #36 (`add-weekly-digest`) sau khi Core v0.5 đã ship: tận dụng `buildReport`, review flagged, và rule-impact local mà không gửi email/Slack (user tự pipe nếu muốn).

## What Changes

- Thêm lệnh `nightowl digest`: đọc store **chỉ đọc** (cùng quy tắc chưa init / ngoài git như `report`), cửa sổ mặc định **7 ngày** (UTC), tuỳ chọn `--since` (YYYY-MM-DD hoặc tương đương đã document, ví dụ `7d`).
- Xuất tóm tắt local: số failure mới (không dismissed), top category / agent, tín hiệu Signals nếu có, gợi ý review còn mở (`flagged`), và đoạn rule-impact ngắn (bản applied mới nhất nếu có — không bắt buộc mark trước).
- Định dạng: Markdown mặc định (stdout); HTML self-contained qua `--format html` + `--output`/`-o` (mặc định hợp lý dưới `.nightowl/` khi ghi file). Không `--open` bắt buộc trong MVP (có thể reuse helper dashboard nếu rẻ).
- **SHALL NOT** tự gửi email/Slack/webhook; **SHALL NOT** gọi mạng / telemetry / LLM; **SHALL NOT** lộ tên/email developer.
- Cập nhật help CLI, completion catalog, README; tick #36 trên `docs/v0.5-roadmap-ideas.md` khi archive.
- Không schema DB mới; không dependency runtime mới.

## Capabilities

### New Capabilities

- `weekly-digest`: Sinh digest định kỳ (Markdown/HTML) từ store NightOwl local cho cửa sổ thời gian đã chọn, không gửi đi ngoài máy.

### Modified Capabilities

- `cli`: Help root liệt kê `digest`; help lệnh mô tả audience nội bộ / local-only + flag.
- `shell-completion`: Catalog gợi ý lệnh `digest` và flag liên quan.

## Impact

- Code: `src/commands/digest.ts`, module `src/digest/` (build + format); đăng ký `commands/index`; tests; completion; README.
- Tái sử dụng `buildReport` / review queries / `compareRuleImpact` (hoặc tương đương chỉ-đọc) — không đổi semantics `report` / `dashboard` / `rule-impact`.
- Không hook, không Action bắt buộc, không mạng.
