# Design

## Context

Đã có `report`, `digest`, `customer-report`, `redactPathsInReport`, privacy profile — nhưng chưa có một lệnh đóng gói. Constraints: local-only, no developer names, Node built-ins (tránh dependency zip), macOS/Linux/Windows.

## Goals / Non-Goals

**Goals:**
- Một lệnh tạo pack offline: report + digest + privacy manifest.
- Redaction path mặc định bật.
- Output thư mục dưới `.nightowl/`; tuỳ chọn `.tar.gz` local.

**Non-Goals:**
- Upload / signed URL / email send.
- Đóng gói raw `nightowl.db` hoặc export JSONL đầy đủ code (tránh leak).
- Zip format (stdlib không có) — dùng **tar.gz** hoặc chỉ directory.
- SaaS / multi-tenant share.

## Decisions

1. **Tên lệnh:** `share-pack` (rõ “pack”, tránh nhầm `init --shared`).

2. **Nội dung pack**
   - `report.md` — `formatText(buildReport(...))` sau `redactPathsInReport` khi redaction on.
   - `digest.md` — digest markdown cùng cửa sổ `--since` (mặc định lookback digest hiện có).
   - `manifest.json` — `{ generatedAt, since, redactPaths, files[], nightowlVersion? }`.
   - Không gồm customer-report HTML bắt buộc (có thể phase sau); MVP = report + digest + manifest.

3. **Flags**
   - `--since`, `--depth`, `--agent` (giống report/digest khi rẻ).
   - `--redact-paths` default **true** cho share-pack; `--no-redact-paths` để tắt (parseBoolean negation hoặc `--redact-paths=false` — chọn `--no-redact-paths` boolean).
   - `-o/--output <dir>` — thư mục pack; default `.nightowl/share/<ISO-ish stamp>/`.
   - `--archive` — ghi thêm `<dir>.tar.gz` (hoặc file cạnh dir) bằng `zlib.createGzip` + ustar writer nhỏ trong repo (không dependency).

4. **Reuse**
   - Mở store read-only; tái sử dụng `buildReport` / `buildDigest` / workspace prepare nếu support `--workspace` (optional MVP: không workspace trừ khi rẻ — **skip workspace in MVP** để giữ scope).

5. **Version trong manifest**
   - Đọc từ `package.json` của package nightowl nếu có đường dẫn bundled; nếu không, omit field.

## Risks / Trade-offs

- **tar.gz ≠ zip** — document; Windows Explorer mở tar.gz kém hơn zip; chấp nhận để zero-dep.  
- **Redaction default true** khác `report` (default false) — đúng cho share; help phải nêu rõ.  
- **Ustar size limits** — pack nhỏ (text only); OK.
