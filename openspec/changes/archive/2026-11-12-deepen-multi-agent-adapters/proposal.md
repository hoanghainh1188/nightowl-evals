# Proposal

## Why

Sau harden maturity (#18/#harden), Claude Code + Cursor đã `verified`, nhưng `windsurf` / `cline` / `roo` vẫn chủ yếu dựa `parseGenericAgent` + marker/hooks tối thiểu — team dùng nhiều tool cùng lúc khó tin ingest và khó biết giới hạn từng agent. Cần làm sâu adapter/fixture và kiểm tra `init`/`doctor` mà vẫn fail-open.

## What Changes

- Thêm **adapter parse chuyên biệt** (hoặc contract fixture gần payload tool hơn) cho tier `best-effort` hiện có (`windsurf`, `cline`, `roo`); giữ Claude Code + Cursor không hồi quy.
- Làm sâu **`doctor` / `init`**: kiểm tra hình dạng cấu hình đã document (không chỉ “file tồn tại” / marker), báo rõ khi cấu hình lệch contract; agent `manual` vẫn chỉ hướng dẫn wrap.
- **Document giới hạn từng agent** (README + help liên quan): sự kiện hỗ trợ, rủi ro auto-detect, bước thủ công còn lại.
- Giữ **fail-open**, không telemetry, không chậm agent/git; **không** bịa hook native cho `manual`.
- **Không** thêm agent id mới trong change này. Promotion maturity (vd. `windsurf` → `verified`) chỉ khi adapter + install + fixture đạt bar đã document; mặc định ưu tiên làm sâu trước, promote có điều kiện trong design.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `agent-ingest`: yêu cầu adapter/fixture sâu hơn cho best-effort; phân biệt contract từng agent vs generic hints yếu
- `project-setup`: `init`/`doctor` kiểm tra sâu hơn cấu hình đa agent theo maturity; authenticity/shape đã document
- `cli`: help/`doctor` nêu kiểm tra adapter sâu hơn và trỏ giới hạn theo agent

## Impact

- `src/agents/` (parser riêng hoặc module per-agent thay thế phần lớn đường generic cho windsurf/cline/roo), `src/setup/agent-config.ts` / authenticity helpers, `src/commands/doctor.ts` / `init.ts`, README bảng agent + limitations.
- Tests: fixture JSON gần payload thật hơn (≥1 prompt + ≥1 edit mỗi best-effort agent); doctor cases cho config lệch shape.
- Không dependency runtime mới; không đổi schema SQLite trừ khi design bắt buộc (ưu tiên tránh).
