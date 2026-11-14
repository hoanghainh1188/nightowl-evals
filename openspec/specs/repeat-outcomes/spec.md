# repeat-outcomes Specification

## Purpose

Định nghĩa metric lỗi lặp (repeat vs new) deterministic từ cluster key trên store NightOwl local, để team chứng minh cải thiện theo thời gian mà không gửi dữ liệu ra ngoài máy.

## Requirements

### Requirement: Định nghĩa repeat và new
Trong cửa sổ báo cáo (window), một `cluster_key` (cùng quy tắc clustering đã document) SHALL là **repeat** nếu key đó cũng xuất hiện ít nhất một lần trong cửa sổ baseline trước window; ngược lại là **new**. Chỉ failure không `dismissed` và đủ dữ liệu để tạo key SHALL được xét. Metric SHALL NOT gọi mạng hoặc LLM.

#### Scenario: Key xuất hiện ở cả baseline và window
- **WHEN** cùng `cluster_key` có ≥1 failure đủ điều kiện trong baseline và ≥1 trong window
- **THEN** key đó được đếm là repeat

#### Scenario: Key chỉ có trong window
- **WHEN** `cluster_key` chỉ xuất hiện trong window, không có trong baseline
- **THEN** key đó được đếm là new

#### Scenario: Dismissed không đếm
- **WHEN** failure trong baseline hoặc window có status `dismissed`
- **THEN** failure đó SHALL NOT tạo hoặc giữ key cho metric repeat

### Requirement: Đếm và tỷ lệ repeat
Hệ thống SHALL tính: số key **repeat**, số key **new**, và `repeat_rate` = repeat / (repeat + new) khi mẫu số > 0; khi mẫu số = 0, `repeat_rate` SHALL là `null` (không hiện 0% giả). Đếm theo **key phân biệt**, không theo số failure trong cluster.

#### Scenario: Có cả repeat và new
- **WHEN** window có 2 key repeat và 3 key new
- **THEN** repeat=2, new=3, repeat_rate=0.4

#### Scenario: Không có key nào
- **WHEN** window không có failure đủ điều kiện để tạo key
- **THEN** repeat=0, new=0, repeat_rate=null

### Requirement: Cửa sổ baseline
Khi người dùng cung cấp mốc baseline đã document (ví dụ `--baseline-since`), baseline SHALL là [baseline_since, window_since). Khi chỉ có `--since` (window start) và không có baseline tường minh, baseline mặc định SHALL là cửa sổ liền trước window với cùng độ dài UTC đã document. Khi không có `--since` (toàn lịch sử), metric repeat MAY để rate null hoặc bỏ so sánh — hành vi SHALL được document và ổn định.

#### Scenario: Baseline tường minh
- **WHEN** window bắt đầu `2026-11-01` và baseline-since `2026-10-01`
- **THEN** baseline gồm failure với `created_at` trong `[2026-10-01T00:00:00.000Z, 2026-11-01T00:00:00.000Z)`

#### Scenario: Baseline mặc định cùng độ dài
- **WHEN** chỉ có `--since` tạo window độ dài D ngày và không truyền baseline tường minh
- **THEN** baseline là D ngày UTC liền trước `since`

### Requirement: Không lộ danh tính và secret
Metric và mọi surface của nó SHALL NOT gồm tên/email developer. Fingerprint trong key SHALL giữ quy tắc opaque/redact của clustering hiện có.

#### Scenario: Output không có PII developer
- **WHEN** in hoặc serialize metric repeat
- **THEN** không có trường tên/email/username developer
