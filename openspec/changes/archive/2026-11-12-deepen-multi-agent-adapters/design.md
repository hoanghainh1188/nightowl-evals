# Design

## Context

Registry hiện tại: `claude-code`/`cursor` = verified (parser riêng); `windsurf`/`cline`/`roo` = best-effort qua `parseGenericAgent` + `KIND_HINTS` + file config; `copilot-workspace`/`aider` = manual (wrap only). `doctor` đã check marker/`hasNightowlAgentMarker` và authenticity JSON parse cơ bản, nhưng chưa phân biệt shape contract từng best-effort agent đủ rõ. Constraints: fail-open, no network, no new runtime deps, macOS/Linux/Windows.

## Goals / Non-Goals

**Goals:**
- Parser/contract riêng cho `windsurf`, `cline`, `roo` với fixture gần payload đã document hơn.
- `doctor`/`init` kiểm tra và ghi shape tối thiểu theo agent; README + help nêu giới hạn.
- Giữ Claude/Cursor và manual agents ổn định; promote maturity chỉ khi đạt bar.

**Non-Goals:**
- Thêm agent id mới hoặc SaaS sync.
- Đảm bảo IDE third-party luôn gọi hook (ngoài tầm NightOwl).
- Đổi schema SQLite / telemetry / LLM mặc định.
- Viết fake native hooks cho `manual`.

## Decisions

1. **Per-agent modules under `src/agents/`**  
   Thêm `windsurf.ts` / `cline.ts` / `roo.ts` (hoặc một `best-effort/<id>.ts`) với `looksLike*` + `parse*`, wire trong `detect.ts` trước generic fallback. Giữ `generic.ts` cho forced/manual và tương thích ngược.  
   *Alt:* chỉ mở rộng `KIND_HINTS` — rejected vì không đáp ứng “adapter chuyên biệt” và dễ nhầm giữa agents.

2. **Fixture shape**  
   Mỗi best-effort agent: ≥1 prompt + ≥1 edit fixture dùng field/event đã document (session/cwd/path). Đặt dưới `test/agents/fixtures/` hoặc inline trong `adapters.test.ts` nếu nhỏ. Không claim “official vendor schema” nếu chưa xác minh — document là NightOwl contract.

3. **Doctor shape checks**  
   Tái sử dụng helpers merge/remove hiện có (`hasWindsurfNightowlHooks`, marker helpers) và bổ sung kiểm tra field bắt buộc (`nightowl`, `command` chứa nightowl log, agent id khi applicable). Warn-only trừ `--strict`.

4. **Maturity promotion**  
   Mặc định giữ `windsurf`/`cline`/`roo` là `best-effort` trừ khi install path + doctor authenticity + fixtures đạt bar `verified` (tool-readable config + adapter fixtures) và README cập nhật. Promote `windsurf` → `verified` chỉ nếu design apply xác nhận hooks.json là đường tool đọc được ổn định; nếu không chắc, không promote trong change này.

5. **Docs**  
   README bảng agent: cột/ghi chú limitations (events, manual steps). `doctor`/`init` help: một dòng về shape/maturity checks.

## Risks / Trade-offs

- **False confidence:** fixture “gần thật” vẫn có thể lệch IDE — mitigates bằng maturity `best-effort` + README limits.  
- **Auto-detect collisions:** event names trùng giữa agents — giữ thứ tự `BEST_EFFORT_ORDER`, prefer explicit `agent` / `--agent`.  
- **Doctor noise:** shape warn trên repo chỉ dùng Claude — chỉ warn khi file tồn tại nhưng lệch, hoặc khi init đã cài agent đó; tránh warn missing cho agent không chọn nếu hành vi hiện tại đã vậy (giữ semantics hiện có trừ khi tasks siết).  
- **Windows paths:** ingest vẫn dùng path helpers hiện có; không scope lại #41.
