# Spec Delta

## ADDED Requirements

### Requirement: digest đọc defaults từ local config
Khi không truyền flag tương ứng, `nightowl digest` SHALL áp dụng defaults từ local-config đã merge cho cửa sổ (`since` / lookback đã document), `agents`, và `workspaces` nếu có. Flag CLI thắng. Config invalid SHALL thoát ≠ 0 với stderr rõ.

#### Scenario: Lookback từ config
- **WHEN** config đặt digest lookback/window đã document và chạy `digest` không `--since`
- **THEN** digest dùng cửa sổ từ config thay vì chỉ built-in mặc định

#### Scenario: Không có config giữ mặc định cũ
- **WHEN** không có file config và chạy `digest` không `--since`
- **THEN** hành vi cửa sổ mặc định hiện tại vẫn giữ
