# Spec Delta

## ADDED Requirements

### Requirement: changedRate tôn trọng --workspace
Khi `nightowl report` chạy với `--workspace` và có dữ liệu check gắn path file (edit/check có `file_path`), `changedRate` (và head-to-head dựa trên cùng nguồn check) SHALL chỉ đếm checks thuộc workspace đã chọn, cùng quy tắc khớp path với filter failure. Khi không có `--workspace`, semantics `changedRate` SHALL không đổi.

#### Scenario: Gate theo một package
- **WHEN** repo monorepo có checks/failures trong `packages/ui` và package khác, chạy `nightowl report --workspace packages/ui --fail-on-rate <N>`
- **THEN** `changedRate.checked` / failures dùng cho rate chỉ phản ánh `packages/ui` (không cộng check ngoài workspace)

#### Scenario: Không --workspace giữ full-window
- **WHEN** chạy `nightowl report` không có `--workspace`
- **THEN** `changedRate` vẫn trên toàn cửa sổ `--since` như hiện tại

### Requirement: Cảnh báo khi gate + workspace lệch mẫu số
Khi vừa có `--workspace` vừa có `--fail-on-rate`, nếu NightOwl không thể scope đủ checks theo path (vd. check không có `file_path`) hoặc mẫu số rõ ràng không cùng tập với failures đã lọc, lệnh SHALL cảnh báo trên stderr (thoát theo ngưỡng rate như cũ; cảnh báo không đổi mã thoát trừ khi design chọn `--strict` — mặc định chỉ warn).

#### Scenario: Check thiếu path khi đang filter workspace
- **WHEN** `--workspace` + `--fail-on-rate` và tồn tại check trong cửa sổ không gắn `file_path` nên không vào mẫu số workspace
- **THEN** stderr có cảnh báo về scope/mẫu số; hành vi fail-on-rate vẫn dựa trên `changedRate` đã document

### Requirement: Signals document khi có --workspace
Với `--workspace`, phần signals (ci-fail / pr-review / revert) SHALL được document là **full-window theo `--since`** trừ khi một signal có path và design chọn lọc (mặc định: không lọc signals). Report text và/hoặc `--json` MAY gắn ghi chú scope; help/README SHALL nêu rõ.

#### Scenario: README/help nêu signals full-window
- **WHEN** đọc README hoặc `nightowl report --help` sau change
- **THEN** có câu nói signals không bị `--workspace` thu hẹp (trừ khi ghi chú khác đã document)
