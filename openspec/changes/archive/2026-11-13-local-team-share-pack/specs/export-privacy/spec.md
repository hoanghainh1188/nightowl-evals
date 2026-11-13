# Spec Delta

## ADDED Requirements

### Requirement: Share-pack dùng profile privacy chung
Lệnh share-pack SHALL áp dụng cùng profile redaction/coarsen path đã document của export-privacy cho nội dung report/digest trong gói khi redaction bật (mặc định bật cho share). SHALL NOT gọi mạng.

#### Scenario: Pack bật coarsen path
- **WHEN** tạo share-pack với redaction mặc định và report có module path sâu
- **THEN** path trong file report của gói đã coarsen theo profile chung
