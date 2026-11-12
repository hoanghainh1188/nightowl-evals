# Spec Delta

## Purpose

Gom nhóm failure AI local theo category, module và fingerprint diff deterministic để triage / report / suggest-rules thao tác theo nhóm thay vì từng id, không gửi dữ liệu ra ngoài máy.

## ADDED Requirements

### Requirement: Cluster key deterministic
NightOwl SHALL gán mỗi failure đủ dữ liệu một `cluster_key` ổn định từ: category (hoặc `unclassified`), module theo depth đã document, agent khi có, và fingerprint của thay đổi AI→final. Cùng input SHALL cho cùng key trên macOS, Linux và Windows. Clustering SHALL NOT gọi LLM hay mạng.

#### Scenario: Hai failure giống nhau cùng key
- **WHEN** hai failure cùng category, cùng module (cùng depth), cùng agent (hoặc cùng thiếu), và cùng fingerprint nội dung
- **THEN** chúng có cùng `cluster_key`

### Requirement: Fingerprint không lộ secret
Fingerprint dùng trong cluster key / báo cáo SHALL là mã opaque (ví dụ hex digest). NightOwl SHALL NOT ghi plaintext secret đã lọc vào fingerprint string, log, hay HTML dashboard. Khi nội dung bị redact vì secret, fingerprint SHALL vẫn deterministic trên bản đã redact hoặc đánh dấu mẫu “redacted” đã document — không nhúng secret gốc.

#### Scenario: Nội dung chứa secret đã lọc
- **WHEN** `aiContent`/`finalContent` chứa chuỗi khớp chính sách secret của NightOwl rồi tính cluster
- **THEN** `cluster_key` / fingerprint xuất ra không chứa substring secret đó

### Requirement: Liệt kê cluster từ store local
Hệ thống SHALL cung cấp danh sách cluster trong cửa sổ lọc (status/since/agent khi áp dụng): mỗi cluster có key, count ≥ ngưỡng tối thiểu đã document (mặc định ≥ 2 trừ khi caller hạ ngưỡng), và sample failure ids hoặc paths (giới hạn số sample đã document).

#### Scenario: Đủ failure trùng nhóm
- **WHEN** store có ≥2 failure non-dismissed cùng cluster key trong cửa sổ
- **THEN** danh sách cluster gồm nhóm đó với `count` ≥ 2 và ít nhất một sample id/path
