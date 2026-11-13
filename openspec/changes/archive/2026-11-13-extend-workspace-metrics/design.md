# Design

## Context

`report` đã `applyWorkspaceFilter` trên failures/clusters nhưng `countChecksForReport` chỉ group theo day/outcome/agent — **không có `file_path`**, nên `changedRate` luôn full-window. Signals đếm event kind theo `--since`, thường không gắn package. Constraints: local-only, không đổi semantics khi không có `--workspace`, macOS/Linux/Windows path normalize đã có.

## Goals / Non-Goals

**Goals:**
- Scope `changedRate` (+ head-to-head từ cùng checks) theo `--workspace` khi check có path.
- Warn khi `--fail-on-rate` + `--workspace` mà checks thiếu path / mẫu số lệch.
- Document signals = full-window với `--workspace`.

**Non-Goals:**
- Scope signals theo workspace trong change này (trừ khi path rõ và effort nhỏ — mặc định document-only).
- Đổi mặc định Action trừ khi chỉ cần truyền `--workspace` sẵn có.
- Migration DB / telemetry.

## Decisions

1. **Mở rộng `CheckCountRow` / query**  
   Join check → edit (hoặc cột path đã có trên event check) để mỗi hàng check mang `filePath` khi biết được. Group key thêm `file_path` (hoặc trả hàng per-path rồi aggregate sau filter).  
   *Alt:* heuristic agent-only — rejected, không đủ cho monorepo packages.

2. **Filter tái sử dụng `applyWorkspaceFilter`**  
   Sau query, `applyWorkspaceFilter(checksWithPath, ws.filter, ws.all)`; rows `filePath` null/empty bị loại khi filter ≠ null.

3. **Warn policy**  
   Nếu `ws.filter !== null` && `failOnRate !== null` && (có check bị drop vì thiếu path **hoặc** zero scoped checks trong khi full-window có checks): stderr một dòng cảnh báo. Không đổi exit code ngoài ngưỡng rate.

4. **Signals**  
   Giữ full-window; README + `report --help` nêu rõ. JSON có thể thêm `scope: { workspace: [...], signals: "full-window" }` nếu rẻ — optional trong tasks.

5. **Callers**  
   `dashboard` / `digest` nếu build rate từ cùng pipeline: áp dụng cùng filter checks khi chúng truyền workspace; nếu không tính rate thì chỉ touch `report`.

## Risks / Trade-offs

- **Check không gắn edit path** → rate workspace có thể `checked=0` trong khi full-window có data — mitigates bằng warning.  
- **Query chậm hơn** trên DB lớn — giữ index hiện có; đo trong test; `#47` xử lý perf sâu hơn.  
- **BREAKING nhẹ cảm nhận:** CI đã dùng `--workspace` + `--fail-on-rate` sẽ thấy rate đổi (đúng hơn) — document trong README release note ngắn.
