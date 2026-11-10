## ADDED Requirements

### Requirement: Help review nêu chế độ interactive
`nightowl review --help` SHALL nêu `-i` / `--interactive` và tóm tắt phím tắt chính (điều hướng, xem diff, confirm/dismiss/reset, thoát).

#### Scenario: review --help có -i
- **WHEN** chạy `nightowl review --help`
- **THEN** stdout có `-i` hoặc `--interactive` và nhắc các phím `c` / `d` / `q` (hoặc tương đương đã document)
