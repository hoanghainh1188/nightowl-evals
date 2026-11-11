# Design

## Context

See `proposal.md` — Why. Hiện đã có `buildReport` + `openExistingStore` dùng chung bởi `report` và `customer-report`; HTML khách nằm ở `src/customer-report/format.ts` (self-contained, không CDN). Chưa có lệnh dành cho viewer nội bộ hay helper mở `file://` cross-platform.

## Goals / Non-Goals

**Goals:**
- Lệnh `dashboard` tái sử dụng pipeline số liệu của `report`, xuất HTML nội bộ rõ ràng (không nhầm với `customer-report` VI–JA).
- Mở file local qua OS opener khi `--open`, zero runtime deps, macOS/Linux/Windows.
- Ranh giới open-core rõ trong code/docs: local file viewer ≠ SaaS team dashboard.

**Non-Goals:**
- HTTP server / `localhost` bind (để lại ideation sau nếu cần).
- Live reload, auth, multi-user, sync remote, chart library CDN.
- Đổi semantics `report` / `customer-report` hoặc schema SQLite.
- Clustering / noise filter / revert signals (ideation 33–35 riêng).

## Decisions

1. **Lệnh mới `dashboard`, không nhét vào `report --format`**
   - *Rationale:* Audience và UX khác (ghi file + `--open`); giữ `report` ổn định cho CI/`--json`/`--fail-on-rate`.
   - *Alternative:* `report --format html` — dễ lẫn cổng CI và thiếu chỗ tự nhiên cho `--open`.

2. **Tái sử dụng `buildReport` + `openExistingStore`**
   - *Rationale:* Một nguồn sự thật số liệu; giảm drift với `report`/`customer-report`.
   - *Alternative:* Query SQL riêng cho dashboard — trùng logic, khó bảo trì.

3. **Formatter riêng `src/dashboard/` (HTML tiếng Anh nhãn kỹ thuật hoặc trung lập)**
   - *Rationale:* Không tái dùng template VI–JA của customer-report (đối tượng khác). Inline CSS đơn giản, bảng/section; có thể bar width bằng CSS thuần.
   - *Alternative:* Fork customer HTML — kéo theo i18n khách không cần thiết.

4. **Default output `.nightowl/dashboard.html`**
   - *Rationale:* Nằm trong thư mục đã gitignore; không làm bẩn root; dễ đoán.
   - *Alternative:* stdout-only như customer-report — kém hợp với `--open` và “mở xem nhanh”.

5. **`--open` qua helper injectable `openPath(path)` (darwin `open`, win32 `cmd /c start ""`, linux `xdg-open`)**
   - *Rationale:* Node built-ins (`child_process`); test inject fake opener; không HTTP.
   - *Alternative:* `node:http` serve 127.0.0.1 — thêm surface bảo mật/port, không cần cho MVP file://.

6. **Strict `parseArgs`; từ chối `--fail-on-rate`**
   - *Rationale:* Đồng bộ customer-report; tránh dùng nhầm làm CI gate.

## Risks / Trade-offs

- [file:// bị trình duyệt hạn chế] → Mitigation: HTML self-contained, không fetch ngoài; document rằng một số browser siết local file — vẫn đọc được nội dung tĩnh.
- [Nhầm với SaaS dashboard trong marketing] → Mitigation: README/help nhấn “local-only HTML”; roadmap đã phân biệt.
- [Ghi đè `.nightowl/dashboard.html` mỗi lần chạy] → Mitigation: chấp nhận (artifact tạm); `--output` khi cần giữ bản.
- [Opener thiếu trên CI/headless] → Mitigation: không bật `--open` mặc định; test không gọi opener thật.

## Migration Plan

- Thêm lệnh + docs; không migration DB.
- Rollback: gỡ lệnh/đăng ký; file HTML local người dùng tự xoá.

## Open Questions

Không có (HTTP `--serve` cố ý hoãn; ngôn ngữ UI dashboard mặc định English labels kỹ thuật — chấp nhận được cho team CLI).
