# Design

## Context

`doctor` đã kiểm Claude/Cursor/`AGENT_CONFIGS` và in stats DB với status `ok` kể cả khi `failures.total === 0`. Action preflight chỉ check file tồn tại; README restore vẫn là comment placeholder. Xem proposal.md — Why.

## Goals / Non-Goals

**Goals:**

- Doctor: warn khi DB ok nhưng 0 failure (report-readiness); giữ kiểm tra agent theo maturity.
- Action/README: ví dụ restore cụ thể + preflight/empty-data messaging rõ hơn.
- Fail-open hooks; không tạo DB trên CI.

**Non-Goals:**

- Không chạy `doctor --strict` trên runner (hook agent không cần cho gate).
- Không upload/sync DB tự động từ máy dev.
- Không đổi ngưỡng `fail-on-rate` / sticky comment.
- Không làm #28 customer quality report.

## Decisions

1. **Doctor empty-data = `warn`, không `fail`**
   - Tránh phá workflow local mới init; `--strict` vẫn fail như warn khác.
   - Đổi check “Database statistics” (hoặc tách check “Report readiness”) khi `failures.total === 0`.

2. **Agent checks: giữ logic hiện có; siết message/tests**
   - Spec ADDED khẳng định hành vi đã có (maturity labels + warn thiếu hook) để regression không tuột; chỉ chỉnh copy nếu thiếu rõ.

3. **Action empty DB: dùng CLI nhẹ, không parse SQLite trong bash**
   - Sau preflight file-exists: chạy `nightowl doctor` scoped? Quá nặng/nhiễu hook warns trên CI.
   - Ưu tiên: `nightowl report --json --output …` đã có; thêm bước `nightowl` one-liner nếu có, hoặc đọc count qua `node -e` — **chọn**: gọi helper nhỏ trong composite, ví dụ `nightowl report --json -` / existing JSON và nếu `failures`/`changedRate` cho thấy 0 failures thì `::warning::`. Đơn giản hơn: thêm subcommand không — dùng `nightowl` nếu có flag… 
   - **Chốt MVP:** preflight bash gọi `nightowl report --json --output /tmp/nightowl-preflight.json --fail-on-rate 100` chỉ để đọc? Side-effect gate. Better: extend doctor với `--json` hoặc storage query.
   - **Thực tế tối thiểu khớp spec:** trong bước Preflight, sau khi file tồn tại, chạy `node --experimental-sqlite` hoặc tái dùng binary: `nightowl doctor` và parse dòng statistics — mong manh.
   - **Chốt thiết kế:** thêm hàm/CLI nội bộ không public — hoặc `nightowl report --json` với fail-on-rate cao rồi jq đếm; report hiện trả JSON có tổng failures. Chạy report **một lần** như hiện tại; **trước đó** bước mới: `nightowl` không có `doctor --storage-only`. 
   - Đơn giản nhất đúng spec: bước “Preflight data” chạy `nightowl report --json --out /tmp/nw.json --fail-on-rate 100` rồi jq — vẫn chạy report 2 lần (đắt).
   - **Preferred:** mở rộng doctor stdout ổn định hoặc thêm exit code phụ — overkill.
   - **Implement:** trong `action.yml`, sau Preflight database, chạy:
     ```bash
     nightowl report --json --output "${TMP}/preflight.json" --fail-on-rate 100 || true
     ```
     rồi parse JSON field tổng failure (đúng schema report); nếu 0 → `::warning::`. Sau đó bước report chính chạy như cũ. Hai lần report chấp nhận được cho CI gate (DB local nhỏ).
   - Alternative tốt hơn nếu có API: export `countFailures` qua `nightowl doctor --json` — **nếu effort thấp, thêm `--json` tối thiểu cho doctor chỉ storage** — ghi trong tasks là tuỳ chọn; mặc định dual-report preflight.

4. **README restore**
   - Thay placeholder bằng ví dụ `actions/cache` (key hash files không được vì DB gitignored — dùng cache key cố định/`github.sha` từ job upload trước) **và/hoặc** `download-artifact` từ workflow publish DB (document assumption: team tự upload artifact `nightowl-db`).
   - Không commit DB mẫu.

## Risks / Trade-offs

- [Warn 0 failure làm `--strict` fail ngay sau init] → Mitigation: remedy nói rõ ghi vài failure hoặc bỏ `--strict` đến khi có data.
- [Report chạy 2 lần trên Action] → Mitigation: chấp nhận; hoặc follow-up `doctor --json` gọn hơn.
- [Noise warn agent trên máy chỉ dùng Claude] → Mitigation: giữ warn không fail; remedy “ignore if unused”.

## Migration Plan

- Không migration schema. CLI/Action backward compatible.
- Rollback: revert doctor status + README/Action steps.

## Open Questions

- (không chặn) Có nên thêm `nightowl doctor --json` trong cùng change nếu dual-report quá xấu — ghi optional task.
