# Design

## Context

Đã có `export` → JSONL `nightowl.eval/v1`, `eval` (chấm model + `--test-command`), và `suggest-rules` (heuristic + ghi có chủ đích). Xem proposal — Why. Regression synthesizer nằm giữa: biến failure thành **file test/fixture trong (hoặc cạnh) suite dự án**, không chỉ dataset trong `.nightowl/export/`.

## Goals / Non-Goals

**Goals:**
- Lệnh CLI local: failure đã lọc → khung regression (preview / ghi file).
- Tái dùng eval case + secret filter; định danh ổn định.
- Ghi file chỉ khi user chỉ path; template offline mặc định.

**Non-Goals:**
- Không auto-commit / không mở PR.
- Không sinh test “chạy được 100%” cho mọi ngôn ngữ trong v1.
- Không đổi schema SQLite; không đụng hook.
- Không thay `export` / `eval` hiện có.

## Decisions

1. **Tên lệnh `suggest-regressions`**
   - Khớp `suggest-rules`: “đề xuất / khung”, không ám chỉ ghi đè suite.
   - Alternative: `synthesize-regressions` — bỏ vì dài và nghe như luôn ghi file.

2. **Hai lớp artifact**
   - **Fixture JSON** (`nightowl.eval/v1` một case / file): luôn có thể sinh; mặc định thư mục `.nightowl/regressions/` khi ghi mà không chỉ path (hoặc bắt buộc `--output` — **chốt:** bắt buộc `--output` giống tinh thần “không ghi suite mặc định”; preview stdout liệt kê path dự kiến).
   - **Stub test** theo `--framework`:
     - `json` (default): chỉ fixture.
     - `vitest` / `jest`: file `*.test.ts` nhẹ load fixture + assert tối thiểu hoặc `it.todo` kèm comment `rejected`/`expected` path — đủ để commit và hoàn thiện tay.
   - Detect: nếu không truyền `--framework`, nhìn `package.json` scripts/devDeps; không chắc → `json`.
   - Alternative: chỉ JSON trong `.nightowl/` — yếu vì không vào CI dự án; chỉ stub TS — bỏ vì NightOwl dùng mọi git repo.

3. **Nguồn dữ liệu**
   - Query failure giống export/review (status mặc định `confirmed`); map qua `toEvalCase` + `file_before` khi có `commit_sha` (tái dùng `readFilesBefore` nếu cần fixture đầy đủ).
   - Bỏ sensitive path + inline secret như export.

4. **Ghi an toàn**
   - Marker hoặc phần mở đầu nhận diện NightOwl (ví dụ comment `// nightowl-suggested-regression` / JSON `"schema":"nightowl.eval/v1"`).
   - `--force` mới ghi đè file “lạ”.
   - Atomic write + mode `0600` khi dưới `.nightowl/`; ngoài `.nightowl/` cảnh báo nếu git không ignore (pattern export).

5. **LLM**
   - V1: có thể **hoãn** wire LLM nếu scope chặt — spec vẫn yêu cầu “SHALL NOT call unless opt-in”. Implement: không có `--yes` → không gọi; `--yes` optional rewrite title/description từ fixture đã sanitize, reuse classify transport. Nếu chưa kịp trong tasks, vẫn giữ stub no-op an toàn (không gọi).

6. **Module layout**
   - `src/commands/suggest-regressions.ts`
   - `src/regressions/{types,select,format-json,format-vitest,write}.ts` (tên cuối theo apply)
   - Store: tái dùng `listFailuresToExport` hoặc query mỏng mới nếu cần filter status chặt hơn export hiện tại (export bỏ `dismissed` nhưng không mặc định chỉ `confirmed`).

## Risks / Trade-offs

- [Stub test không chạy thật / nhiễu CI] → Default framework `json`; stub dùng `it.todo` hoặc describe skip có comment rõ; docs: review trước khi bỏ skip.
- [Ghi nhầm vào `test/`] → Bắt buộc `--output`; `--force` cho file không phải NightOwl.
- [Fixture quá lớn / secret] → Cùng truncate/secret policy với export; skip + đếm.
- [Trùng `export`] → Docs phân biệt: export = dataset eval model; suggest-regressions = khung vào suite dự án.

## Migration Plan

1. Ship lệnh + fixture JSON + stub vitest/jest tối thiểu + tests.
2. README ví dụ; archive / sync `regression-synthesis` + `cli`.
3. Tick roadmap change 20 (và 18–19 nếu còn “Dự kiến”).

## Open Questions

- Có cần alias `synthesize-regressions` trong help — quyết sau, không ảnh hưởng spec.
- Có gắn hook sau `review confirm` (auto gợi ý lệnh) — **out of v1**.
