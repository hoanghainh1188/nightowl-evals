# Proposal

## Why

Product doc hứa “dashboard lỗi theo loại, theo module”, nhưng team nội bộ hiện chỉ có `nightowl report` (terminal/JSON) và `customer-report` (tài liệu khách). Cần **viewer HTML local-only** để mở xem nhanh trên máy mà không đẩy dữ liệu lên cloud — bước đầu giai đoạn team (roadmap #32), vẫn open-core, khác hẳn dashboard SaaS thương mại.

## What Changes

- Thêm lệnh `nightowl dashboard`: đọc store local **chỉ đọc** (cùng quy tắc chưa init / ngoài git / schema cũ như `report`), dựng số liệu từ cùng nguồn `buildReport` (+ tín hiệu CI/PR khi có), xuất **HTML tĩnh self-contained** (category, module, agent/head-to-head, tuần, status, changed rate).
- Flag: `--since`, `--depth`, `--agent` (lặp), `--output`/`-o` (mặc định ghi `.nightowl/dashboard.html` trong project root), `--open` (mở file bằng trình duyệt mặc định OS qua `file://` — không HTTP server trong change này).
- Nội dung **chỉ chấm AI**: không tên/email/username developer; không snippet code/PII; không gọi mạng / không telemetry / không LLM.
- Không account, không multi-tenant, không sync remote, không `--fail-on-rate` (cổng CI vẫn thuộc `report`).
- Cập nhật help CLI, completion catalog, README (ranh giới: local dashboard ≠ SaaS team dashboard); tick ideation #32 trên `docs/v0.5-roadmap-ideas.md` khi archive/ship.
- Không schema DB mới; không dependency runtime mới (Node built-ins only).

## Capabilities

### New Capabilities

- `local-dashboard`: Sinh và (tuỳ chọn) mở dashboard HTML chỉ đọc từ dữ liệu NightOwl local trên máy người dùng.

### Modified Capabilities

- `cli`: Help root liệt kê `dashboard`; help lệnh mô tả audience nội bộ / local-only + các flag.
- `shell-completion`: Catalog gợi ý lệnh `dashboard` và flag liên quan.

## Impact

- Code: lệnh mới `src/commands/dashboard.ts`, formatter HTML `src/dashboard/` (hoặc tương đương); đăng ký `src/commands/index.ts`; tests Vitest; `src/completion/catalog.ts`; README / docs roadmap.
- Tái sử dụng `buildReport` / `openExistingStore` — không đổi semantics `nightowl report` hay `customer-report`.
- Không hook, không Action bắt buộc, không mạng (trừ OS mở `file://` khi `--open`).
