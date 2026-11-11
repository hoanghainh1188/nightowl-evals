# Design

## Context

See `proposal.md` — Why. Pre-commit đã có `whitespace_only` và bỏ tạo failure khi `lines_removed === 0` / whitespace trong `attach-commit`. `review` đã có confirm/dismiss nhưng không phản hồi vào scoring. Schema đã có `category_confidence` (LLM classify) — **không** tái dụng cho noise.

## Goals / Non-Goals

**Goals:**
- Module scoring thuần hàm + học đếm local trong SQLite.
- Auto-dismiss chỉ cho tập safe nhỏ, deterministic, có test vàng.
- Surface noise trên `report` JSON/text và dashboard HTML.
- Giữ postcommit fail-open / deadline / exit 0.

**Non-Goals:**
- Clustering (#35), revert (#33), LLM scoring, CDN/SaaS.
- Đổi semantics `whitespace_only` pre-commit (vẫn skip như cũ).
- Auto-dismiss cho “đổi ý” mơ hồ / rename phức tạp chưa có test chắc.

## Decisions

1. **Chấm điểm lúc attach (aiContent vs finalContent), không mở rộng payload git-hook trong change này**
   - *Rationale:* Một chỗ duy nhất khi đã có đủ hai bản nội dung; tránh đổi format commit-check.
   - *Alternative:* Cờ trên pre-commit — sớm hơn nhưng trùng logic và phình payload.

2. **Cột `noise_score` REAL NULL + `noise_reasons` TEXT (CSV reason codes)**
   - *Rationale:* Đủ query/report; không JSON blob bắt buộc.
   - *Alternative:* JSON column — linh hoạt hơn nhưng overkill MVP.

3. **Safe auto-noise → tạo failure `dismissed` với reason gồm `auto-noise` + code cụ thể**
   - *Rationale:* Giữ audit trail và đếm auto-noise; khác whitespace skip (không có hàng). Comment-only vào đây; whitespace tiếp tục skip ở pre-attach như hiện tại.
   - *Alternative:* Không tạo hàng — mất khả năng đo auto-noise count chi tiết.

4. **Tập reason MVP:** `comment-only`, `format-only` (chuẩn hoá bỏ whitespace + punctuation phổ biến), cộng `learned-dismiss` khi trọng số học vượt ngưỡng. Safe auto-dismiss: `comment-only` (+ optional `format-only` nếu test vững). Không safe: điểm cao nhưng vẫn `flagged`.

5. **Bảng `noise_stats`:** `reason_key TEXT PRIMARY KEY`, `dismiss_count`, `confirm_count`, `updated_at`. Cập nhật trong cùng transaction với review mark khi có thể.

6. **Công thức score đơn giản, documented trong code comment + README:** base từ reasons (union max), cộng `min(cap, k * dismiss/(dismiss+confirm+1))` cho learned; clamp [0,1].

7. **`report.noise`:** `{ review_rate: number | null, auto_noise: number, sample: { confirmed, dismissed } }`. Text một dòng; dashboard một section.

## Risks / Trade-offs

- [False auto-dismiss] → Mitigation: safe set hẹp + golden tests; chỉ comment-only trước nếu format-only flaky.
- [Học lệch theo một user] → Mitigation: chỉ local DB; confirm giảm trọng số; không ship model.
- [Trùng nghĩa với category_confidence] → Mitigation: tên cột/API tách `noise_*`; docs phân biệt.
- [Postcommit deadline] → Mitigation: scoring O(n lines) thuần; không I/O thêm ngoài DB đã mở.

## Migration Plan

- Thêm migration N: columns + `noise_stats`.
- Rollback: gỡ lệnh/logic đọc cột (SQLite giữ cột hại).

## Open Questions

Không có (format-only đưa vào safe chỉ khi test ổn — mặc định flagged + score nếu flaky).
