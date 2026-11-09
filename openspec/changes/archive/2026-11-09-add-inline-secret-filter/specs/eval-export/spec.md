# Spec Delta

## MODIFIED Requirements

### Requirement: Không xuất file nhạy cảm
Lệnh SHALL NOT xuất bản ghi lỗi của file có tên thuộc nhóm bí mật (cùng quy tắc với hook Claude Code: `.env*`, khoá, `credentials`, …) hoặc bản ghi mà nội dung code chứa secret inline, kể cả khi database có sẵn bản ghi đó, và SHALL báo trên stderr số bản ghi đã bỏ.

#### Scenario: Bản ghi lỗi của .env
- **WHEN** database có một bản ghi lỗi cho `.env`
- **THEN** file xuất không có bản ghi đó và stderr báo đã bỏ 1 bản ghi nhạy cảm

#### Scenario: Bản ghi lỗi chứa secret inline
- **WHEN** database có bản ghi lỗi mà `rejected` hoặc `expected` chứa private key hoặc API token
- **THEN** file xuất không có bản ghi đó và được đếm là bản ghi nhạy cảm bị bỏ qua
