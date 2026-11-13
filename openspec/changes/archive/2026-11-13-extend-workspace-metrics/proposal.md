# Proposal

## Why

`--workspace` (#39) chỉ lọc failures; `changedRate` (và do đó `--fail-on-rate`) cùng signals vẫn tính full-window — gate CI trên một package monorepo dễ lệch mẫu số. Cần cùng phạm vi metrics khi filter workspace, và document/cảnh báo rõ chỗ không scope được.

## What Changes

- Khi `--workspace` active, `changedRate` / head-to-head check counts SHALL dùng cùng tập path workspace (checks có `file_path` thuộc package đã chọn).
- Document (README + help + report text/json note khi cần) rằng **signals** (ci-fail / pr-review / revert) mặc định vẫn cửa sổ `--since` full-repo trừ khi có path gắn được — và **cảnh báo** khi `--fail-on-rate` + `--workspace` mà mẫu số check không cùng scope với failures (hoặc signals không scoped).
- Giữ hành vi không-filter (không `--workspace`) không đổi.
- **Không** bắt buộc đổi Action inputs trừ khi design chọn thêm flag; ưu tiên CLI `report` (và caller dùng cùng buildReport) trước.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `failure-report`: scope `changedRate`/checks theo `--workspace`; cảnh báo gate lệch mẫu số; document signals
- `workspace-awareness`: semantics filter áp dụng cho path-bearing check rows (không chỉ failures)
- `cli`: help `report` nêu scope metrics / cảnh báo khi `--workspace` + `--fail-on-rate`

## Impact

- `src/storage/report-queries.ts` (checks kèm path khi có), `src/report/build.ts` / `src/commands/report.ts`, có thể dashboard/digest nếu dùng cùng rate; tests report + workspace.
- Docs README / help. Không network, không schema breaking bắt buộc (có thể mở rộng query SELECT).
