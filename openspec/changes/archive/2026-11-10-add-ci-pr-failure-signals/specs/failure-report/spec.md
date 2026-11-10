# Spec Delta

## ADDED Requirements

### Requirement: Báo cáo tín hiệu CI và PR
`nightowl report` SHALL gồm số đếm sự kiện/tín hiệu CI fail và PR review trong cửa sổ `--since` (không tính dismissed failures cho phần failure hiện có). Bản `--json` SHALL có trường đã document (ví dụ `ci_signals` / `pr_signals` hoặc tương đương) với số nguyên ≥ 0.

#### Scenario: Có CI fail trong cửa sổ
- **WHEN** store có ≥1 sự kiện CI trong `--since` và chạy `nightowl report --json`
- **THEN** JSON phản ánh số đếm CI > 0

#### Scenario: Không có tín hiệu
- **WHEN** không có sự kiện CI/PR trong cửa sổ
- **THEN** các trường đếm tương ứng bằng 0; lệnh vẫn thoát 0
