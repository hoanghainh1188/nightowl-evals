# Spec Delta

## ADDED Requirements

### Requirement: Doctor cảnh báo thiếu dữ liệu cho report
Khi `.nightowl/nightowl.db` tồn tại và toàn vẹn nhưng chưa có failure đã ghi (tổng failure = 0), `nightowl doctor` SHALL báo **cảnh báo** (không fail) rằng dữ liệu chưa đủ để `report` hữu ích, kèm gợi ý ghi failure (hooks/`init`) trước khi dùng CI gate. `--strict` SHALL coi cảnh báo này như các warn khác (thoát mã 1).

#### Scenario: DB có nhưng chưa có failure
- **WHEN** chạy `nightowl doctor` với database hợp lệ và 0 failure
- **THEN** stdout có cảnh báo thiếu dữ liệu cho report và mã thoát 0 (không `--strict`)

#### Scenario: --strict với DB trống failure
- **WHEN** chạy `nightowl doctor --strict` với database hợp lệ và 0 failure
- **THEN** lệnh thoát mã 1 vì có cảnh báo sẵn sàng report

#### Scenario: Đã có failure thì không cảnh báo thiếu dữ liệu
- **WHEN** database có ≥1 failure và chạy `nightowl doctor`
- **THEN** không có cảnh báo “thiếu dữ liệu cho report” vì lý do 0 failure

### Requirement: Doctor báo rõ hook đa agent theo maturity
`nightowl doctor` SHALL tiếp tục kiểm tra cấu hình ingest đa agent (Claude, Cursor verified, agent best-effort/manual đã document) và SHALL nêu rõ từng agent/maturity trên stdout (ok hoặc warn khi thiếu marker/file). Thiếu hook agent SHALL là cảnh báo, không phải lỗi nghiêm trọng, trừ khi `--strict`.

#### Scenario: Thiếu Cursor hooks
- **WHEN** repo chưa có NightOwl Cursor hooks và chạy `nightowl doctor`
- **THEN** stdout cảnh báo Cursor/agent tương ứng kèm gợi ý `nightowl init --agents …`, thoát 0

#### Scenario: Agent verified đã cài
- **WHEN** Cursor (hoặc agent verified) đã có marker NightOwl hợp lệ
- **THEN** stdout đánh dấu nhóm agent đó hợp lệ (ok)
