# Spec Delta

## ADDED Requirements

### Requirement: Action tuỳ chọn ingest CI artifact
Composite Action SHALL chấp nhận input tuỳ chọn (ví dụ đường dẫn JUnit/summary) để chạy `nightowl ingest-ci` trên runner **trước** `report` khi input được set và file tồn tại. Khi input trống, hành vi gate/`report` hiện tại SHALL không đổi.

#### Scenario: Có artifact JUnit
- **WHEN** workflow truyền path JUnit hợp lệ và DB NightOwl có sẵn
- **THEN** Action chạy ingest rồi `report`; sự kiện CI có trong DB dùng cho report nếu cùng job

#### Scenario: Không truyền path ingest
- **WHEN** input ingest để trống
- **THEN** Action không gọi ingest-ci; chỉ gate/`report` như hiện tại

### Requirement: Action không bắt buộc gọi GitHub để ingest PR
Ingest comment PR qua API trong Action SHALL tắt mặc định. Nếu có input opt-in ingest PR, Action SHALL tuân thủ cùng quy tắc token/opt-in của CLI và SHALL NOT gửi dữ liệu tới máy chủ NightOwl.

#### Scenario: Mặc định không ingest PR qua API
- **WHEN** dùng Action chỉ với fail-on-rate và comment báo cáo như hiện tại
- **THEN** không gọi API GitHub ngoài bước sticky report comment đã có (khi comment bật)
