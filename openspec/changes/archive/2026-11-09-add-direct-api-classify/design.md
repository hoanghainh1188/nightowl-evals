# Design

## Context

`classify` gọi `runClaude` (spawn CLI). Parse nằm ở `classify/parse.ts`, prompt ở `classify/prompt.ts`. Xem proposal.md — Why. Node 22+ đã có `fetch`; không thêm SDK Anthropic để giữ dependency tối thiểu.

## Goals / Non-Goals

**Goals:**
- Abstraction gọi model: CLI hoặc Anthropic HTTP, cùng interface trả raw string để `parseClaudeOutput` dùng lại.
- Opt-in rõ (`--transport api` + `--yes` + env key).
- Không lộ API key trong output/log.

**Non-Goals:**
- Không hỗ trợ OpenAI/Gemini trong change này.
- Không đưa API vào `eval` (chỉ classify).
- Không lưu key trong `.nightowl/` hay settings.
- Không streaming UI.

## Decisions

1. **Flag `--transport cli|api`**
   - Rõ hơn boolean `--api`; mở rộng transport sau này.
   - Default `cli` → không breaking.

2. **Env `ANTHROPIC_API_KEY`**
   - Chuẩn Anthropic; không flag `--api-key` trên CLI (tránh lọt shell history).
   - Thay thế đã xét: đọc file — bỏ qua cho P2.

3. **Module `run-api.ts` song song `run-claude.ts`**
   - `POST https://api.anthropic.com/v1/messages` với headers `x-api-key`, `anthropic-version`, `content-type`.
   - Body: `model`, `max_tokens`, `messages: [{role:user, content: prompt}]`, và cách ép JSON (tool/json schema hoặc instruction + parse nghiêm — ưu tiên response format mà API hỗ trợ ổn định; nếu chỉ text, nhúng schema trong system/user như hiện tại và parse bằng `parseClaudeOutput`).
   - Timeout AbortController (~120s như CLI).
   - Map lỗi HTTP/timeout sang kiểu lỗi tương thích để classify đếm failure.

4. **Classifier metadata**
   - Lưu `classifier` dạng `anthropic-api:<model>` để phân biệt với CLI trong report/review.

5. **Dry-run**
   - In transport; với api không kiểm tra key bắt buộc (cho phép xem trước), nhưng có thể cảnh báo nếu thiếu key mà không fail (chỉ fail khi `--yes`).

6. **Khoá và giới hạn**
   - Giữ `classify.lock`, limit, redo không đổi.

## Risks / Trade-offs

- [Model id CLI ≠ API] → Document: với `--transport api`, `--model` là model id Anthropic (ví dụ `claude-haiku-4-5-20251001`); default có thể map `haiku` → id ổn định đã pin trong code.
- [Thay đổi Anthropic API] → Pin `anthropic-version` header; test với mock fetch.
- [User tưởng local-only] → Dry-run và README nói rõ dữ liệu gửi tới Anthropic khi api.

## Migration Plan

- Không migration DB.
- README + help: bảng transport; ví dụ `ANTHROPIC_API_KEY=… nightowl classify --yes --transport api`.
- Archive xong: tick P2 trong `docs/production-readiness.md`.

## Open Questions

- Có cần `--api-base-url` cho proxy doanh nghiệp không? Để sau nếu có nhu cầu thật.
