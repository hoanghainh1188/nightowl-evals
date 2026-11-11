# Proposal

## Why

Team CI và `doctor` vẫn dễ “xanh giả”: hook đa agent đã được kiểm một phần, nhưng DB trống vẫn báo ok; Action chỉ có comment placeholder restore `.nightowl/`, nên runner thiếu DB hoặc thiếu dữ liệu làm `report` vô nghĩa mà hướng dẫn chưa đủ rõ.

## What Changes

- `nightowl doctor`: cảnh báo sớm khi database tồn tại nhưng chưa có failure (hoặc tương đương “chưa sẵn sàng cho report”); giữ/làm rõ kiểm tra hook đa agent theo maturity (không phá fail-open).
- Composite Action + README: hướng dẫn restore `.nightowl/nightowl.db` cụ thể hơn (artifact/cache/self-hosted), không chỉ placeholder; preflight thiếu DB vẫn fail rõ với bước restore gợi ý.
- Không tự tạo/sync DB trên runner; không telemetry; không bắt buộc hook agent trên CI runner.

## Capabilities

### New Capabilities

- (không có)

### Modified Capabilities

- `project-setup`: bổ sung cảnh báo sẵn sàng report (DB trống / thiếu failure) trong `doctor`; làm rõ kỳ vọng kiểm tra hook đa agent đã cài.
- `github-action`: siết tài liệu/ví dụ restore DB và thông báo preflight; cảnh báo sớm khi DB có nhưng không đủ dữ liệu cho report (không invent data).

## Impact

- `src/commands/doctor.ts` (+ tests `test/commands/doctor.test.ts`)
- `action/action.yml` (preflight messaging), có thể script phụ nếu cần kiểm tra nhẹ
- README mục GitHub Action / restore DB
- Specs: `openspec/specs/project-setup`, `openspec/specs/github-action`
