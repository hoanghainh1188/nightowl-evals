# Spec Delta

## Purpose

Xuất báo cáo chất lượng AI dạng Markdown (và HTML tùy chọn) từ dữ liệu NightOwl local, dùng mẫu song ngữ Việt–Nhật để gửi khách, không lộ danh tính developer và không gọi mạng.

## ADDED Requirements

### Requirement: Lệnh customer-report
`nightowl customer-report` SHALL đọc store dự án chỉ đọc (không tạo DB nếu chưa có), dựng báo cáo chất lượng AI từ cùng nguồn số liệu với `report` (tổng lỗi không dismissed, tỷ lệ sửa, theo category/module/agent, xu hướng tuần), in ra stdout dạng Markdown theo mặc định, rồi thoát mã 0.

#### Scenario: Có dữ liệu lỗi
- **WHEN** database có lỗi đã phân loại và lần kiểm tra sau commit, rồi chạy `nightowl customer-report`
- **THEN** stdout là Markdown chứa tổng lỗi, tỷ lệ sửa (hoặc n/a), breakdown category/module/agent và tuần; mã thoát 0

#### Scenario: Chưa có lỗi
- **WHEN** database chưa có bản ghi lỗi và chưa có lần kiểm tra, rồi chạy `nightowl customer-report`
- **THEN** stdout Markdown nói chưa có dữ liệu đủ để báo cáo chất lượng; mã thoát 0

### Requirement: Chỉ đọc store như report
Khi chưa có `.nightowl/nightowl.db`, ngoài repo git, hoặc schema cũ hơn phiên bản hiện tại, `nightowl customer-report` SHALL báo lỗi rõ trên stderr, thoát mã 1, và SHALL NOT tạo hay nâng cấp database.

#### Scenario: Chưa init
- **WHEN** chạy `nightowl customer-report` trong repo git chưa có `.nightowl/`
- **THEN** stderr gợi ý `nightowl init`, mã thoát 1, không tạo `.nightowl/`

### Requirement: Lọc since, depth, agent
Với `--since <YYYY-MM-DD>`, báo cáo SHALL chỉ tính dữ liệu từ 00:00 UTC ngày đó. Với `--depth`, module SHALL dùng cùng quy tắc depth như `report` (mặc định 2). Với một hoặc nhiều `--agent <id>`, báo cáo SHALL chỉ tính lỗi/kiểm tra của agent đó. Giá trị không hợp lệ SHALL lỗi stderr và thoát mã 1.

#### Scenario: since sai định dạng
- **WHEN** chạy `nightowl customer-report --since 11/11/2026`
- **THEN** stderr báo ngày không hợp lệ, mã thoát 1

#### Scenario: lọc agent
- **WHEN** database có lỗi từ nhiều agent và chạy `nightowl customer-report --agent claude-code`
- **THEN** số liệu trong Markdown chỉ phản ánh agent đó

### Requirement: Ngôn ngữ VI–JA
`--lang` SHALL chấp nhận `vi`, `ja`, hoặc `both` (mặc định `both`). Với `vi` hoặc `ja`, toàn bộ nhãn/heading/template SHALL dùng đúng ngôn ngữ đó. Với `both`, báo cáo SHALL có phần tiếng Việt và phần tiếng Nhật (cùng số liệu). Template SHALL nằm trong package local; lệnh SHALL NOT gọi mạng để dịch.

#### Scenario: mặc định both
- **WHEN** chạy `nightowl customer-report` không có `--lang`
- **THEN** stdout Markdown có cả phần tiếng Việt và tiếng Nhật với cùng các chỉ số chính

#### Scenario: chỉ tiếng Nhật
- **WHEN** chạy `nightowl customer-report --lang ja`
- **THEN** heading/nhãn chính bằng tiếng Nhật và không bắt buộc có phần tiếng Việt

### Requirement: Định dạng Markdown và HTML
`--format` SHALL chấp nhận `md` (mặc định) hoặc `html`. Với `md`, stdout/file SHALL là Markdown. Với `html`, stdout/file SHALL là HTML đơn giản self-contained (không CDN ngoài). Giá trị khác SHALL lỗi và thoát mã 1.

#### Scenario: HTML
- **WHEN** chạy `nightowl customer-report --format html` với dữ liệu hợp lệ
- **THEN** stdout bắt đầu bằng cấu trúc HTML hợp lệ (ví dụ chứa `<html` hoặc `<!DOCTYPE`) và mã thoát 0

### Requirement: Xuất file --output
Với `--output <path>` (hoặc `-o <path>`), lệnh SHALL ghi toàn bộ nội dung báo cáo vào file đó (tạo thư mục cha nếu cần), SHALL NOT in nội dung đó ra stdout, và thoát mã 0 khi thành công. Đường dẫn rỗng SHALL lỗi và thoát mã 1.

#### Scenario: ghi Markdown ra file
- **WHEN** chạy `nightowl customer-report --output dist/customer-quality.md` trong dự án có dữ liệu
- **THEN** file được tạo chứa Markdown báo cáo; stdout không chứa toàn bộ báo cáo; mã thoát 0

### Requirement: Không lộ danh tính developer
Báo cáo SHALL NOT chứa tên người, email, username git author/committer, hay đường dẫn tuyệt đối dưới home người dùng. Chỉ được nêu chỉ số về AI (agent id đã biết trong NightOwl, category, module tương đối, tuần, tỷ lệ sửa).

#### Scenario: không có author
- **WHEN** database có failure gắn với lần kiểm tra commit có author người thật, rồi chạy `nightowl customer-report`
- **THEN** stdout không chứa tên/email author đó

### Requirement: Không fail-on-rate
`nightowl customer-report` SHALL NOT hỗ trợ `--fail-on-rate`. Flag đó xuất hiện SHALL bị từ chối (strict parse) với lỗi stderr và thoát mã 1; cổng CI vẫn thuộc `nightowl report`.

#### Scenario: từ chối fail-on-rate
- **WHEN** chạy `nightowl customer-report --fail-on-rate 30`
- **THEN** stderr báo tuỳ chọn không hợp lệ / không hỗ trợ, mã thoát 1
