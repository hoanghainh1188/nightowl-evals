# Design

## Context

See `proposal.md` — Why. CI/PR đã dùng `events` + `dedupe_key` + `SIGNAL_KINDS` trên report. Failures lưu `commit_sha` khi attach post-commit. Source CHECK hiện tại: `agent-hook|git|ci|pr` — revert dùng `source=git`, `kind=revert` **không cần** đổi CHECK source.

## Goals / Non-Goals

**Goals:**
- CLI `nightowl ingest-revert` scan local git, ghi event idempotent, link failure khi có.
- Surface count trên report/dashboard Signals.
- Document giới hạn squash/rewrite/cherry-pick.

**Non-Goals:**
- Tự động chạy trên mọi post-commit (có thể follow-up opt-in).
- GitHub API / SaaS.
- Bịa `ai_content` hoặc tạo failure mới không có bản gốc.
- Phục hồi đầy đủ mọi kiểu revert thủ công.

## Decisions

1. **MVP = events only (không tạo failure phụ)**
   - *Rationale:* Khớp CI/PR; tránh nhân failure và nhiễu report.total.
   - *Alternative:* Copy failure gốc với source mới — để follow-up nếu cần eval.

2. **Phát hiện revert**
   - Parse `git log` subject/body cho `This reverts commit <fullsha>` (git revert mặc định).
   - Thêm: nếu commit có đúng 1 parent thứ hai kiểu revert merge — optional nếu test vững; MVP ưu tiên message chuẩn.
   - Cửa sổ: `--since <date>` (default: 30 ngày hoặc toàn bộ nếu nhỏ — document default 30d).

3. **Khớp NightOwl**
   - Tập SHA từ `failures.commit_sha` (và optionally `checks_attached.commit_sha`) trong DB.
   - Event payload: `{ reverted_commit_sha, revert_commit_sha, failure_ids: number[] }`.
   - `dedupe_key`: `revert:<reverted_sha>:<revert_sha>`.

4. **SIGNAL_KINDS** thêm `'revert'`; `ReportSignals` thêm `revert: number`; format text/JSON/dashboard cập nhật.

5. **Fail-open**
   - Module scan trả `[]` + log nếu git lỗi khi được gọi từ đường không phải CLI bắt buộc; CLI `ingest-revert` fail nếu không phải git repo / chưa init.

## Risks / Trade-offs

- [Miss squash] → Document; không cố parse squash.
- [Short SHA ambiguity] → Chỉ khớp full SHA 40 hex từ message revert.
- [Large repos] → Giới hạn `--since`; không walk toàn bộ mặc định vô hạn nếu default 30d.

## Migration Plan

- Không migration schema bắt buộc (kind tự do).
- Rollback: gỡ lệnh + bỏ `revert` khỏi SIGNAL_KINDS/formatters.

## Open Questions

Không có (hook post-commit opt-in để sau).
