# Spec Delta

## ADDED Requirements

### Requirement: Help nêu metric repeat và baseline
`nightowl report --help` SHALL mô tả metric repeat (lỗi lặp theo cluster key) và mọi flag baseline liên quan (ví dụ `--baseline-since`) nếu được thêm. `nightowl digest --help` và/hoặc `dashboard --help` SHALL đề cập tóm tắt repeat khi lệnh đó surface metric. Help SHALL NOT hứa sync cloud hay chấm người.

#### Scenario: report --help có repeat
- **WHEN** chạy `nightowl report --help`
- **THEN** stdout đề cập repeat, lỗi lặp, hoặc baseline window liên quan

#### Scenario: Flag baseline không hợp lệ
- **WHEN** truyền giá trị baseline không parse được (nếu flag tồn tại)
- **THEN** lệnh thoát ≠ 0 với stderr rõ, không ghi DB
