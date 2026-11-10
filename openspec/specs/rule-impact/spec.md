# rule-impact Specification

## Purpose

Cho phép team đánh dấu rule dự án đã áp dụng và đo, trên dữ liệu NightOwl local, sự thay đổi số lỗi AI (cùng bộ lọc) trước và sau thời điểm áp dụng — không gửi dữ liệu đi đâu và không gọi LLM.

## Requirements

### Requirement: Đánh dấu rule đã áp dụng kèm baseline
`nightowl` SHALL cung cấp lệnh tường minh (tên đã document, ví dụ `rule-impact mark`) để ghi một bản ghi “rule applied” vào store dự án: nhãn/id người dùng cung cấp, thời điểm áp dụng (mặc định now UTC), bộ lọc tùy chọn (category / module / agent), và snapshot baseline số failure khớp bộ lọc tại thời điểm ghi. Lệnh SHALL NOT tạo DB nếu chưa init (lỗi rõ, thoát ≠ 0). Lệnh SHALL NOT gọi mạng hoặc LLM.

#### Scenario: Mark thành công
- **WHEN** repo đã init và chạy mark với `--label "convention-naming"` và `--category convention`
- **THEN** store có ≥1 bản ghi applied; baseline có số đếm ≥ 0; thoát 0

#### Scenario: Chưa init
- **WHEN** chạy mark khi chưa có `.nightowl/nightowl.db`
- **THEN** không tạo DB; stderr hướng dẫn init; thoát ≠ 0

### Requirement: So sánh cửa sổ trước và sau áp dụng
Lệnh xem impact (ví dụ `rule-impact` / `rule-impact show`) SHALL, với một bản ghi applied (mặc định bản mới nhất hoặc theo id/label đã document), so sánh số failure (không tính `dismissed`) trong cửa sổ **sau** `applied_at` với cửa sổ **trước** cùng độ dài (hoặc cửa sổ `--before-days` / `--after-days` đã document). Kết quả text và `--json` SHALL gồm số trước, số sau, và delta (có thể kèm theo category nếu filter đã set).

#### Scenario: Có giảm lỗi
- **WHEN** baseline/mark có filter category `convention`, cửa sổ trước có 4 failure, cửa sổ sau có 1 failure, và chạy show
- **THEN** stdout/JSON phản ánh before=4, after=1, delta âm (giảm); thoát 0

#### Scenario: Không có bản ghi applied
- **WHEN** store không có bản ghi applied và chạy show
- **THEN** thoát ≠ 0 với thông báo rõ; không bịa số liệu

### Requirement: Không đổi report CI gate
Lệnh impact SHALL NOT thay đổi hành vi mặc định của `nightowl report` hay `--fail-on-rate`. Đếm impact SHALL độc lập với sticky Action comment trừ khi người dùng chạy lệnh impact tường minh.

#### Scenario: report không bắt buộc impact
- **WHEN** chỉ chạy `nightowl report --json` sau khi có bản ghi applied
- **THEN** JSON report vẫn hợp lệ như trước; không bắt buộc có trường impact

### Requirement: Idempotent / không nhân bản vô hạn theo khóa tự nhiên
Mark lặp với cùng khóa tự nhiên đã document (ví dụ cùng `label` + cùng `applied_at` ngày, hoặc id tường minh) SHALL NOT tạo vô số bản ghi trùng; lần sau cập nhật hoặc từ chối rõ theo design (document một hành vi).

#### Scenario: Mark cùng label trong cùng ngày (theo design dedupe)
- **WHEN** mark hai lần với cùng `--label` theo quy tắc dedupe đã document
- **THEN** số bản ghi tương ứng khóa đó không tăng gấp đôi sau lần hai (hoặc lần hai thoát ≠ 0 với thông báo)
