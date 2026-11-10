# Tasks

## 1. Registry maturity

- [x] 1.1 Thêm `AGENT_MATURITY` (verified/best-effort/manual) cạnh `AGENT_IDS`; export helper `maturityOf(agent)`; verify unit test map đủ mọi id + Claude/Cursor = verified
- [x] 1.2 README: bảng agent + maturity + cách cấu hình (hook vs manual wrap); verify khớp registry

## 2. Parsers và fixtures

- [x] 2.1 Fixture + parse path cho từng agent ngoài Claude/Cursor theo maturity (module riêng hoặc contract rõ trên generic); verify mỗi agent ≥1 test fixture → event đúng `agent` hoặc assert manual-only documented
- [x] 2.2 Cập nhật `detectAndParse` order (Claude → Cursor → explicit → per-agent → generic); verify không hồi quy test Claude/Cursor hiện có; verify không ghi khi payload ép agent sai contract

## 3. Init / uninstall theo maturity

- [x] 3.1 `init`/`uninstall`: verified/best-effort ghi đúng schema path đã document; manual không tạo hook native giả + warning; verify tests install/uninstall theo từng nhóm maturity
- [x] 3.2 Giữ idempotent Cursor/Claude; verify init hai lần không nhân đôi

## 4. Doctor và CLI help

- [x] 4.1 `doctor` kiểm tra Cursor + agent verified/best-effort; manual = info thủ công; verify cảnh báo thiếu Cursor; `--strict` fail khi có cảnh báo
- [x] 4.2 `doctor --help` / `init --help` nêu đa agent + maturity; verify chuỗi help

## 5. Kiểm tra tích hợp

- [x] 5.1 `npm test` / typecheck / `openspec validate --change harden-multi-agent-adapters` xanh

## Workflow follow-up

- Archive sau khi Harry duyệt apply và merge.
- Tick roadmap #25 Done trong `openspec/project.md` / `docs/v0.4-roadmap-ideas.md` khi archive/sync.
