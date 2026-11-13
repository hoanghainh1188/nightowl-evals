# Spec Delta

## ADDED Requirements

### Requirement: Doctor đo thời gian query report mẫu
`nightowl doctor` SHALL đo thời gian (ms) của ít nhất một thao tác đọc kiểu report trên store local (ví dụ đếm failures trong cửa sổ gần) và báo kết quả. Khi vượt ngân sách đã document, SHALL cảnh báo (warn). SHALL NOT gọi mạng.

#### Scenario: Doctor báo timing ok
- **WHEN** chạy `nightowl doctor` trên DB nhỏ/nhanh
- **THEN** stdout có dòng timing/query budget (ok) hoặc tương đương đã document

#### Scenario: Doctor cảnh báo khi chậm
- **WHEN** đo vượt ngưỡng budget đã document (hoặc fixture mô phỏng)
- **THEN** doctor đánh dấu warn cho kiểm tra timing và vẫn thoát 0 trừ khi `--strict` và design bắt fail
