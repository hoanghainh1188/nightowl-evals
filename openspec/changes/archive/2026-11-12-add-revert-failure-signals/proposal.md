# Proposal

## Why

Lỗi AI lọt qua review rồi bị **revert sau vài ngày** là tín hiệu mạnh trong product doc, nhưng NightOwl mới có CI/PR signals — chưa phát hiện revert git gắn commit từng tạo failure (roadmap #33).

## What Changes

- Thêm ingest **revert signals** local: quét lịch sử git (message / parent của revert) để tìm commit SHA đã lưu trên `failures.commit_sha` (hoặc checks_attached), ghi sự kiện `revert` vào store.
- Khi suy ra được failure gốc: payload liên kết `failure_id` / `reverted_commit_sha`; **không bịa** `ai_content` — nếu tạo failure phụ thì chỉ tái dùng nội dung đã có từ failure gốc (hoặc chỉ ghi event).
- Fail-open: thiếu git history / squash / cherry-pick không khớp → bỏ qua hoặc cảnh báo, không crash hook; lệnh CLI báo rõ giới hạn.
- `nightowl report` / `dashboard` đếm tín hiệu revert trong cửa sổ `--since` (cùng nhóm Signals, không trộn vào `total` failures trừ khi document tạo failure phụ).
- README document lệnh + giới hạn; tick #33 trên `docs/v0.5-roadmap-ideas.md` khi archive.
- **Không** SaaS, không mạng, không LLM, không clustering/digest.

## Capabilities

### New Capabilities

- `revert-signals`: Phát hiện và ghi tín hiệu revert git local liên kết failure/commit NightOwl đã biết.

### Modified Capabilities

- `local-storage`: Cho phép sự kiện kind/source revert (migration nếu cần CHECK constraint).
- `failure-report`: Báo cáo đếm tín hiệu revert.
- `local-dashboard`: Hiển thị đếm revert trên Signals.
- `cli`: Đăng ký lệnh ingest-revert (hoặc tên tương đương đã document).

## Impact

- Code: module scan git revert + `nightowl ingest-revert`, events/SIGNAL_KINDS, report/dashboard formatters, tests với fake git repo; có thể gọi từ post-commit opt-in sau (MVP: CLI trước, hook optional).
- Schema: có thể mở rộng kind/source events; idempotent theo `reverted_commit_sha` + dedupe_key.
- Out of scope: GitHub API, auto email, bịa snapshot AI, rewrite history recovery đầy đủ.
