# Proposal

## Why

Công ty outsource VN–Nhật cần **báo cáo chất lượng AI gửi khách** (song ngữ VI–JA), không phải bảng kỹ thuật stdout của `nightowl report`. Hiện chưa có lệnh xuất tài liệu Markdown (và HTML tùy chọn) từ dữ liệu local — thiếu điểm khác biệt bán hàng đã nêu trong roadmap #28 / `docs/nightowl-evals.md`.

## What Changes

- Thêm lệnh `nightowl customer-report`: đọc store local (chỉ đọc, cùng quy tắc “chưa init / ngoài git” như `report`), dựng số liệu từ cùng nguồn `buildReport` (tỷ lệ sửa, category/module/agent, xu hướng tuần), xuất **Markdown song ngữ VI–JA** (template local, không gọi mạng).
- Tuỳ chọn `--lang vi|ja|both` (mặc định `both`), `--format md|html` (mặc định `md`; HTML đơn giản self-contained), `--since`, `--depth`, `--agent`, `--output` / `-o` (ghi file, tạo thư mục cha nếu cần).
- Nội dung **chỉ chấm AI**: không tên / email / username developer; không nội dung file hay snippet commit mang PII; module path tương đối như báo cáo nội bộ.
- Không thêm `--fail-on-rate` vào lệnh này (cổng CI vẫn thuộc `report`).
- Cập nhật help CLI, completion catalog, README (ví dụ xuất báo cáo khách).
- Không schema DB mới; không telemetry; không LLM.

## Capabilities

### New Capabilities

- `customer-quality-report`: Xuất báo cáo chất lượng AI cho khách từ dữ liệu NightOwl local (Markdown/HTML, mẫu VI–JA, không lộ danh tính developer).

### Modified Capabilities

- `cli`: Help root / `-h` liệt kê `customer-report`; help lệnh mô tả audience khách + flag `--lang` / `--format`.
- `shell-completion`: Catalog gợi ý lệnh `customer-report` và các flag liên quan.

## Impact

- Code: lệnh mới dưới `src/commands/`, formatter/template dưới `src/report/` (hoặc `src/customer-report/`); đăng ký `src/commands/index.ts`; tests Vitest; `src/completion/catalog.ts`; README.
- Tái sử dụng `buildReport` / openExistingStore — không đổi semantics `nightowl report`.
- Không hook, không Action bắt buộc, không mạng.
