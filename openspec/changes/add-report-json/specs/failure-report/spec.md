# Spec Delta: failure-report

## MODIFIED Requirements

### Requirement: Lọc theo ngày và xuất JSON
Với `--since <YYYY-MM-DD>`, báo cáo SHALL chỉ tính bản ghi lỗi và lần kiểm tra tạo từ 00:00 UTC ngày đó. Với `--json`, stdout SHALL là một object JSON hợp lệ chứa cùng các số liệu. Với `--output <path>` (hoặc `-o <path>`), báo cáo SHALL được ghi vào file chỉ định (tạo thư mục cha nếu cần). Với `--fail-on-rate <0-100>`, nếu tỷ lệ code AI bị sửa (`changedRate.rate * 100`) vượt quá ngưỡng và có dữ liệu kiểm tra (`changedRate.checked > 0`), lệnh SHALL báo lỗi tỷ lệ vượt ngưỡng ra stderr và thoát mã 1; nếu không có dữ liệu kiểm tra hoặc tỷ lệ trong ngưỡng cho phép, lệnh SHALL thoát mã 0. Giá trị tuỳ chọn không hợp lệ SHALL làm lệnh báo lỗi và thoát mã 1.

#### Scenario: Ngày sai định dạng
- **WHEN** chạy `nightowl report --since 04/11/2026`
- **THEN** stderr báo ngày không hợp lệ, mã thoát 1

#### Scenario: Xuất ra file với --output
- **WHEN** chạy `nightowl report --json --output dist/reports/nightowl.json` trong dự án có dữ liệu
- **THEN** file `dist/reports/nightowl.json` được tạo chứa JSON hợp lệ của báo cáo, và lệnh thoát mã 0

#### Scenario: Vượt ngưỡng kiểm soát với --fail-on-rate
- **WHEN** tỷ lệ code AI bị sửa là 40% (2 lỗi trên 5 lần kiểm tra) và chạy `nightowl report --fail-on-rate 30`
- **THEN** stderr cảnh báo tỷ lệ lỗi (40%) vượt quá ngưỡng 30%, và lệnh thoát mã 1

#### Scenario: Trong ngưỡng kiểm soát với --fail-on-rate
- **WHEN** tỷ lệ code AI bị sửa là 20% (1 lỗi trên 5 lần kiểm tra) và chạy `nightowl report --fail-on-rate 25`
- **THEN** stdout in báo cáo bình thường và lệnh thoát mã 0

#### Scenario: Chưa có dữ liệu kiểm tra với --fail-on-rate
- **WHEN** chưa có lần kiểm tra nào ghi nhận (`checked == 0`) và chạy `nightowl report --fail-on-rate 20`
- **THEN** stdout in thông báo bình thường và lệnh thoát mã 0 mà không bị fail
