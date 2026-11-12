# Spec Delta

## ADDED Requirements

### Requirement: Review list kèm cluster key
`nightowl review` (list text và `--json`) SHALL kèm `cluster_key` (hoặc tương đương đã document) cho mỗi failure khi tính được. Lệnh SHALL hỗ trợ lọc theo cluster (ví dụ `--cluster <key>`) để chỉ hiện failure thuộc key đó. Interactive TUI MAY dùng cùng filter nếu đã có `-i`; không bắt buộc đổi toàn bộ UX TUI trong change này nếu list CLI đã đủ.

#### Scenario: Lọc theo cluster
- **WHEN** có failure thuộc cluster key `K` và chạy `nightowl review --cluster K`
- **THEN** list chỉ gồm failure có cluster key `K` (sau các filter status/source/agent khác)
