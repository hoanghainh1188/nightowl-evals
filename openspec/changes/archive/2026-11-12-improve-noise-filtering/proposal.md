# Proposal

## Why

Team nội bộ khó tin số liệu khi nhiều “failure” chỉ là đổi ý / format / comment. Hiện NightOwl chỉ bỏ khoảng trắng (`whitespace_only`) và nhờ `review dismiss` thủ công — chưa có điểm tin cậy hay ước lượng nhiễu trên `report` / dashboard (roadmap #34).

## What Changes

- Thêm heuristic **noise scoring** khi gắn failure (so `aiContent` ↔ `finalContent`): nhận diện thêm các mẫu nhiễu an toàn (ví dụ chỉ comment, chỉ format/punctuation ngoài whitespace đã có), gắn `noise_score` (0–1) và `noise_reasons` deterministic.
- Với mẫu nhiễu **an toàn đã chốt** (không phải đoán mơ hồ): auto-`dismissed` (hoặc không tạo failure giống whitespace) và ghi rõ lý do auto-noise — không LLM, không mạng.
- Học nhẹ **local-only**: khi user `review confirm|dismiss`, cập nhật trọng số/pattern đếm trong SQLite (không telemetry); lần sau cùng reason được cộng điểm nhiễu trong ngưỡng đã document.
- `nightowl report` (JSON + text) và `nightowl dashboard` HTML thêm **ước lượng nhiễu** trong cửa sổ (ví dụ tỷ lệ dismissed/(dismissed+confirmed) và/hoặc tỷ lệ auto-noise) — không lộ tên người.
- Migration schema `failures` (+ bảng/cột feedback local nếu cần); cập nhật README; tick #34 trên `docs/v0.5-roadmap-ideas.md` khi archive.
- **Không** clustering (#35), không revert signals (#33), không SaaS, không gọi LLM cho scoring.

## Capabilities

### New Capabilities

- `noise-filtering`: Chấm điểm / lọc nhiễu local cho failure AI (heuristic + học từ review trên máy) và bề mặt ước lượng nhiễu.

### Modified Capabilities

- `failure-records`: Khi tạo failure từ post-commit, gắn noise metadata; áp dụng quy tắc auto-noise an toàn.
- `failure-review`: `confirm`/`dismiss` cập nhật tín hiệu học local dùng cho scoring sau này.
- `failure-report`: Báo cáo ước lượng nhiễu.
- `local-dashboard`: Hiển thị ước lượng nhiễu trên HTML local.
- `local-storage`: Migration cột/bảng phục vụ noise score và feedback local.

## Impact

- Code: module `src/noise/` (score + learn) gọi khi attach failure (so `aiContent`↔`finalContent`; giữ `whitespace_only` pre-commit như hiện tại), storage migrations + queries, `report`/`dashboard` formatters, `review` mark path; tests Vitest.
- Schema SQLite mới (idempotent via `init`/openStore migrations).
- Hooks vẫn fail-open, postcommit thoát 0 / deadline không đổi.
