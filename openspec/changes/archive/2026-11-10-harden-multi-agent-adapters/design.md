# Design

## Context

Sau `add-multi-agent-support`, `detectAndParse` ưu tiên Claude/Cursor rồi `parseGenericAgent` với `KIND_HINTS`; `AGENT_CONFIGS` ghi marker JSON NightOwl vào đường dẫn ước lượng (`.windsurf/hooks.json`, `.cline/nightowl.json`, …). `doctor` chưa kiểm tra Cursor/các agent khác. Xem proposal.md — Why.

Ràng buộc: fail-open; không mạng; không phụ thuộc runtime mới; Claude/Cursor không hồi quy.

## Goals / Non-Goals

**Goals:**
- Registry maturity công khai (`verified` | `best-effort` | `manual`) gắn với từng `AgentId`.
- Parser + fixture kiểm thử cho từng agent ngoài Claude/Cursor theo maturity.
- `init`/`uninstall`/`doctor`/README khớp maturity (không tuyên bố hook native giả).

**Non-Goals:**
- Thêm agent id mới hoặc MCP ingest.
- CI/PR failure signals (#26), rule-impact (#27), customer report (#28).
- Đảm bảo tương thích vĩnh viễn với mọi phiên bản UI của từng IDE (chỉ contract đã document + fixture).
- Gọi API vendor để “discover” hook schema.

## Decisions

1. **Maturity trong code, không schema DB**  
   Hằng số/registry cạnh `AGENT_IDS` (ví dụ `AGENT_MATURITY`). README và doctor đọc cùng nguồn.  
   *Alternative:* cột SQLite — từ chối (không cần cho query failure).

2. **Tách module parser theo agent khi contract khác generic**  
   Giữ `generic.ts` cho fallback/`--agent` forced lỏng; thêm `windsurf.ts` / `cline.ts` / … khi fixture thật lệch hint. Detect order: Claude → Cursor → explicit field → per-agent looksLike → generic còn lại.  
   *Alternative:* chỉ mở rộng KIND_HINTS — không đủ khi path install/hook event names lệch hoàn toàn.

3. **Gán maturity mặc định (có thể chỉnh khi apply nếu fixture chứng minh khác)**  
   - `claude-code`, `cursor`: `verified`  
   - Agents có document hook JSON gần đúng + fixture parse ổn: `best-effort` (ưu tiên nâng Windsurf nếu hooks.json thật khớp)  
   - Tool không có hook project-file ổn định (thường Aider / một số Copilot path): `manual` — init chỉ in hướng dẫn `nightowl log --agent …` / script wrap  
   Apply được phép đổi một agent từ best-effort ↔ manual nếu research fixture cho thấy không an toàn để ghi file.

4. **init theo maturity**  
   `verified`/`best-effort`: installer riêng hoặc `AgentConfigSpec` cập nhật đúng schema tool (không chỉ `{ nightowl: true }`).  
   `manual`: skip ghi file giả; warning + link README section.

5. **doctor**  
   Thêm nhóm/check: Cursor hooks present; với mỗi best-effort đã document path — warn nếu thiếu NightOwl entry; manual — info line. Không nâng thiếu agent hook thành lỗi hard (trừ `--strict` như cảnh báo khác).

6. **Slice triển khai trong một change**  
   Một PR vẫn cover đủ registry (spec yêu cầu), nhưng tasks chia: (a) maturity + doctor + README, (b) parsers/fixtures từng agent, (c) init path cleanup. Không tách nhiều OpenSpec change trừ khi blocked bởi thiếu fixture thật.

## Risks / Trade-offs

- [Hook vendor đổi schema] → Mitigation: fixture + maturity hạ xuống `manual`/`best-effort`; README “unsupported version”.  
- [Ghi nhầm file IDE] → Mitigation: chỉ ghi path đã document; symlink refuse như hiện tại; idempotent merge.  
- [Phát hiện nhầm agent giữa generic hints] → Mitigation: prefer explicit `agent`/`nightowl_agent`; order detect ổn định; tests xung đột payload.  
- [Trùng scope với #31 deepen-doctor] → Mitigation: change này chỉ thêm checks agent hooks; Action/DB restore để #31.

## Migration Plan

- Không migration DB.  
- User đã có marker JSON cũ: `init` lại merge/upgrade hoặc `uninstall` rồi `init`; doctor cảnh báo file lạ.  
- Rollback: revert code; file config user giữ — uninstall NightOwl entries như hiện tại.

## Open Questions

- (Không chặn spec) Phiên bản Windsurf/Cline cụ thể dùng làm fixture “vàng” lúc apply — chốt theo doc công khai gần nhất khi implement.
