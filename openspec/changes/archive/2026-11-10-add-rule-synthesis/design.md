# Design

## Context

Failure đã có category (classify), status (`confirmed`/`flagged`/`dismissed`), agent, và diff AI/final trong SQLite. `classify` / `eval` đã có pattern dry-run + `--yes` + transport `cli|api`. Xem proposal — Why. Roadmap gọi ý `suggest-rules` / optimize-rules từ lỗi lặp.

## Goals / Non-Goals

**Goals:**
- Lệnh CLI local gom failure → Markdown rule suggestions.
- Heuristic luôn chạy offline; LLM chỉ khi opt-in.
- Ghi file chỉ khi user chỉ path rõ ràng.

**Non-Goals:**
- Không auto-merge vào `CLAUDE.md` / `.cursorrules` trong v1 (chỉ gợi ý path + optional `--write`).
- Không đổi schema SQLite.
- Không MCP server; không dashboard.
- Không sinh regression test (change 20 riêng).

## Decisions

1. **Tên lệnh `suggest-rules`**
   - Khớp roadmap / project.md. Help có thể nhắc “rule synthesis”.
   - Alternative: `optimize-rules` — bỏ vì dài và ám chỉ ghi đè; keep suggest.

2. **Hai tầng sinh rule**
   - **Heuristic (default):** nhóm theo `(category, module|file prefix, agent?)`; template tiếng Anh/Vi ngắn: “Prefer X over Y”, kèm 1–2 ví dụ path + tóm tắt diff (đã sanitize).
   - **LLM (opt-in `--yes`):** đưa cụm đã chọn (đã truncate/sanitize) vào prompt “write project rules”; tái dùng transport classify (`cli` / `api`).
   - Alternative: chỉ LLM — từ chối vì trái “LLM off by default” và cần mạng/CLI.

3. **Output**
   - Mặc định stdout.
   - `--output <file>` ghi bản đề xuất (thường `.nightowl/suggested-rules.md`).
   - `--write <path>` alias rõ ràng cho ghi file rule; v1 có thể gộp `--output` = ghi file, không cần hai flag nếu docs đủ rõ — **chốt:** một flag `--output` (+ `--force`), document ví dụ `.nightowl/suggested-rules.md` và hướng dẫn copy thủ công vào CLAUDE.md.
   - Không append tự động vào CLAUDE.md trừ khi `--output CLAUDE.md` + `--force` (user chủ đích).

4. **Filter mặc định**
   - Status: `confirmed` (flag `--status flagged` để thêm).
   - Category: `convention,missing-context` nếu không truyền `--category`.
   - Limit cụm (không phải từng failure): ví dụ top N nhóm theo count.

5. **Module layout**
   - `src/commands/suggest-rules.ts` + `src/rules/{cluster,heuristic,llm,format}.ts`.
   - Query tái dùng / mở rộng `listFailuresToExport` hoặc review-queries với filter agent/status.

6. **Secret**
   - Reuse `containsInlineSecret` trước khi đưa snippet vào template/LLM/output.

## Risks / Trade-offs

- [Rule generic / nhiễu] → Chỉ nhóm có count ≥ ngưỡng nhỏ (ví dụ 2) trừ khi `--limit`/`--min-count 1`; ưu tiên confirmed.
- [LLM bịa quy ước] → Heuristic luôn là baseline; LLM chỉ rewrite wording; ghi chú “review before paste”.
- [Ghi nhầm CLAUDE.md] → Default stdout; `--force` bắt buộc khi overwrite file đã có không phải NightOwl suggestion marker.
- [Context MVP “Claude only” trong config] → Lệnh không phụ thuộc hook Claude; đọc DB đa agent đã ship — OK.

## Migration Plan

1. Ship lệnh + heuristic + tests.
2. Wire LLM opt-in tái dùng classify transport.
3. README ví dụ; archive / sync `rule-synthesis` + `cli`.

## Open Questions

- Ngưỡng `min-count` mặc định (1 vs 2) — chốt 2 khi apply trừ khi fixture quá mỏng thì 1 trong test.
- Có cần marker HTML comment `<!-- nightowl-suggested-rules -->` trong file output để nhận diện `--force` an toàn — nên có.
