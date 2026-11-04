## ADDED Requirements

### Requirement: Đăng ký lệnh review
`nightowl` SHALL đăng ký lệnh `review` với mô tả một dòng, hiện trong hướng dẫn chung. `nightowl review --help` SHALL liệt kê các lệnh con `list`, `show`, `confirm`, `dismiss`, `reset` cùng tuỳ chọn của `list`. Lệnh con lạ hoặc tuỳ chọn lạ SHALL được báo ra stderr với gợi ý `nightowl review --help`, và thoát mã 1.

#### Scenario: Lệnh con gõ sai
- **WHEN** chạy `nightowl review dismis 12`
- **THEN** stderr chứa `dismis` và `--help`, không lỗi nào đổi trạng thái, mã thoát là 1
