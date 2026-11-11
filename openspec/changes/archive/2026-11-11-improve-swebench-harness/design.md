# Design

## Context

`toSweBenchInstance` luôn gán `test_patch: ''`, `FAIL_TO_PASS: []`, `PASS_TO_PASS: []`. `suggest-regressions --output <dir>` ghi `{evalId}.json` và (vitest/jest) `{evalId}.test.ts` với marker `// nightowl-suggested-regression`. Eval id trùng `instance_id` swe-bench (`evalId(failure)`). Xem proposal.md — Why.

## Goals / Non-Goals

**Goals:**

- Opt-in điền harness swe-bench từ stub NightOwl local qua `--regressions-dir`.
- Giữ tương thích: không flag → harness rỗng như cũ.
- Tái dùng nhận diện artifact / `filePatch` (hoặc tương đương) đã có; không mạng.

**Non-Goals:**

- Không tạo official SWE-bench dataset; không chạy harness Docker/SWE-bench.
- Không đổi `suggest-regressions` hay bắt buộc ghi stub trước khi export.
- Không điền `PASS_TO_PASS`; không suy test id từ fixture JSON đơn thuần.
- Không quét toàn repo tìm stub (chỉ thư mục người dùng chỉ định).

## Decisions

1. **Flag `--regressions-dir <dir>` trên `export`**
   - Chỉ có hiệu lực với `--format swe-bench` (format khác: ignore hoặc báo usage — ưu tiên ignore + help ghi rõ, tránh phá jsonl/promptfoo).
   - Alternative: auto-scan `test/**` — từ chối vì chậm/mơ hồ và dễ nhầm file người dùng.

2. **Khớp theo filename = `{instance_id}.test.ts` + marker NightOwl**
   - Cùng quy ước `stubFileName` / `hasRegressionMarker` của regressions.
   - Optional: xác nhận `{id}.json` tồn tại và `schema` nightowl.eval — không bắt buộc để điền harness; stub+marker đủ.
   - Alternative: parse `it('...')` title làm id — mong manh hơn path ổn định.

3. **`FAIL_TO_PASS` = một phần tử: đường dẫn stub relative tới repo root (POSIX)**
   - Đủ để gắn “test cần chuyển fail→pass”; document rõ không phải node-id Jest đầy đủ.
   - Alternative: `path::title` — có thể bổ sung sau nếu cần; MVP path-only.

4. **`test_patch` = unified diff thêm file stub (before rỗng → nội dung stub)**
   - Dùng `filePatch(relPath, '', '', stubContent)` hoặc helper tương đương (before empty).
   - Path trong diff: relative repo như các file khác trong `patch`.

5. **Lỗi path sớm**
   - `regressionsDir` missing/not-dir → exit ≠ 0 trước khi ghi `--out` (cùng tinh thần validate option export).

6. **Stderr (tuỳ chọn UX)**
   - Có thể thêm số instance đã gắn harness (ví dụ `harness=N`) trong dòng tóm tắt hiện có; không bắt buộc cho acceptance nếu tests cover fields.

## Risks / Trade-offs

- [Stub `it.todo` không chạy được trên runner thật] → Mitigation: document best-effort; FAIL_TO_PASS là pointer local, không cam kết SWE-bench score.
- [Đường dẫn relative khác OS] → Mitigation: normalize `/` khi ghi JSONL.
- [Người dùng sửa stub mất marker] → Mitigation: bỏ qua file; harness rỗng cho id đó (không lỗi cả lệnh).
- [Trùng tên file không phải NightOwl] → Mitigation: yêu cầu marker; không `--force` đọc file lạ.

## Migration Plan

- Không migration DB. Deploy: release CLI; user cũ không truyền flag → không đổi output.
- Rollback: bỏ flag / revert module harness lookup.

## Open Questions

- (không có — convention FAIL_TO_PASS = relative stub path đã chốt cho MVP.)
