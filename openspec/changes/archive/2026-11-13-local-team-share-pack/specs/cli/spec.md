# Spec Delta

## ADDED Requirements

### Requirement: Help và đăng ký share-pack
`nightowl --help` SHALL liệt kê lệnh share-pack (tên đã chọn). `nightowl share-pack --help` SHALL mô tả gói local offline, redaction mặc định, output/archive, và rằng lệnh không gọi mạng / không gồm tên developer.

#### Scenario: nightowl --help có share-pack
- **WHEN** chạy `nightowl --help`
- **THEN** stdout liệt kê lệnh share-pack (hoặc tên đã document)

#### Scenario: share-pack --help nêu privacy local
- **WHEN** chạy `nightowl share-pack --help`
- **THEN** stdout đề cập redaction/privacy hoặc no network / offline share
