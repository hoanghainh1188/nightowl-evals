# Design

## Context

`prune` hiện: `--days` (default 30), `--dry-run` đếm hàng, `--vacuum` chạy `VACUUM` không báo size. Snapshot nằm trong `events.payload` JSON (`$.snapshot`). Constraints: local-only, giữ failures, Node built-ins, macOS/Linux/Windows.

## Goals / Non-Goals

**Goals:**
- Ước lượng bytes snapshot trên dry-run và prune thật.
- Retention profiles đặt tên → ngày.
- Tóm tắt kích thước file DB trước/sau VACUUM.

**Non-Goals:**
- Xóa hàng `events` / `failures` / GC phức tạp.
- Auto-prune theo lịch / daemon.
- Exact freelist accounting trước VACUUM (chỉ ước lượng payload + size file quanh vacuum).
- UI SaaS / remote storage.

## Decisions

1. **Bytes estimate**  
   `SUM(length(json_extract(payload, '$.snapshot')))` trên hàng prunable (cùng predicate như count). Báo `snapshotsPruned` + `bytesEstimated`. Không dùng delta page SQLite trước vacuum.

2. **Profiles**  
   Built-in map (document trong help/README):  
   - `short` → 7  
   - `default` → 30  
   - `long` → 90  
   Flag `--profile <name>`. Nếu cả `--profile` và `--days`: **`--days` thắng** (explicit override); MAY warn một dòng trên stderr. Profile lạ → exit 1.

3. **DB size around vacuum**  
   `fs.stat` trên đường dẫn file store (`.nightowl/nightowl.db`) trước và sau `VACUUM`. Báo `dbBytesBefore` / `dbBytesAfter` (và delta nếu hữu ích). Dry-run + `--vacuum`: không VACUUM; stderr một dòng “vacuum skipped in dry-run” (hoặc tương đương), vẫn báo estimate prune.

4. **Output**  
   Mở rộng `PruneResult`; stdout vẫn tiếng Anh ngắn, human-readable (giữ style hiện tại). Không JSON mới trừ khi rẻ — mặc định text thôi.

5. **Completion**  
   Thêm `--profile` vào catalog `prune`.

## Risks / Trade-offs

- **Estimate ≠ disk reclaim** — document: bytes là kích thước snapshot trong payload; dung lượng OS chỉ chắc sau VACUUM qua số file.  
- **VACUUM locks / copy DB** — giữ opt-in `--vacuum`; không đổi.  
- **Large JSON extract** — cùng cửa sổ ngày như prune hiện tại; chấp nhận; `#47` xử lý perf sâu hơn nếu cần.
