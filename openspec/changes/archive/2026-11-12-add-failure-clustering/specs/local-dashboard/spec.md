# Spec Delta

## ADDED Requirements

### Requirement: Dashboard top clusters
HTML từ `nightowl dashboard` SHALL có section top clusters dùng cùng định nghĩa với `report` (key/count, sample category hoặc module). SHALL NOT lộ tên/email developer hay secret plaintext. Khi chưa đủ failure để tạo cluster (dưới ngưỡng), section SHALL nói rõ chưa có nhóm hoặc để trống có chú thích — không bịa count.

#### Scenario: Section cluster trên HTML
- **WHEN** database có ≥2 failure cùng cluster rồi chạy `nightowl dashboard`
- **THEN** file HTML gồm nhãn cluster / grouping và count của nhóm đó
