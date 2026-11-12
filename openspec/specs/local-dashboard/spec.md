# local-dashboard Specification

## Purpose

Cung cấp dashboard HTML chỉ đọc từ dữ liệu NightOwl local trên máy người dùng, để team xem lỗi theo loại/module/agent/tuần mà không đẩy dữ liệu lên cloud hay lộ danh tính developer.

## Requirements

### Requirement: Lệnh dashboard
`nightowl dashboard` SHALL đọc store dự án chỉ đọc, dựng số liệu từ cùng nguồn với `report` (tổng lỗi không dismissed, tỷ lệ sửa, category/module/agent/head-to-head, status, xu hướng tuần, và counts tín hiệu CI/PR khi store có), ghi HTML tĩnh self-contained ra file mặc định `.nightowl/dashboard.html` (tạo thư mục cha nếu cần), in đường dẫn file ra stdout, rồi thoát mã 0.

#### Scenario: Có dữ liệu lỗi
- **WHEN** database có lỗi đã phân loại và lần kiểm tra sau commit, rồi chạy `nightowl dashboard`
- **THEN** file `.nightowl/dashboard.html` tồn tại, là HTML hợp lệ chứa tổng lỗi, tỷ lệ sửa (hoặc n/a), breakdown category/module/agent và tuần; stdout nêu đường dẫn file; mã thoát 0

#### Scenario: Chưa có lỗi
- **WHEN** database chưa có bản ghi lỗi và chưa có lần kiểm tra, rồi chạy `nightowl dashboard`
- **THEN** file HTML vẫn được tạo và nêu chưa có dữ liệu đủ; mã thoát 0

### Requirement: Chỉ đọc store như report
Khi chưa có `.nightowl/nightowl.db`, ngoài repo git, hoặc schema cũ hơn phiên bản hiện tại, `nightowl dashboard` SHALL báo lỗi rõ trên stderr, thoát mã 1, và SHALL NOT tạo hay nâng cấp database (ngoài việc không ghi HTML đích khi lỗi mở store).

#### Scenario: Chưa init
- **WHEN** chạy `nightowl dashboard` trong repo git chưa có `.nightowl/`
- **THEN** stderr gợi ý `nightowl init`, mã thoát 1, không tạo database NightOwl

### Requirement: Lọc since, depth, agent
Với `--since <YYYY-MM-DD>`, dashboard SHALL chỉ tính dữ liệu từ 00:00 UTC ngày đó. Với `--depth`, module SHALL dùng cùng quy tắc depth như `report` (mặc định 2). Với một hoặc nhiều `--agent <id>`, dashboard SHALL chỉ tính lỗi/kiểm tra của agent đó. Giá trị không hợp lệ SHALL lỗi stderr và thoát mã 1.

#### Scenario: since sai định dạng
- **WHEN** chạy `nightowl dashboard --since 11/11/2026`
- **THEN** stderr báo ngày không hợp lệ, mã thoát 1

#### Scenario: lọc agent
- **WHEN** database có lỗi từ nhiều agent và chạy `nightowl dashboard --agent claude-code`
- **THEN** số liệu trong HTML chỉ phản ánh agent đó

### Requirement: Xuất file --output
Với `--output <path>` (hoặc `-o <path>`), lệnh SHALL ghi HTML vào path đó thay vì mặc định `.nightowl/dashboard.html` (tạo thư mục cha nếu cần), in đường dẫn ra stdout, và thoát mã 0 khi thành công. Đường dẫn rỗng SHALL lỗi và thoát mã 1.

#### Scenario: ghi ra path tuỳ chọn
- **WHEN** chạy `nightowl dashboard --output dist/ai-dashboard.html` trong dự án có dữ liệu
- **THEN** file `dist/ai-dashboard.html` được tạo chứa HTML dashboard; mã thoát 0

### Requirement: Mở trình duyệt local với --open
Với `--open`, sau khi ghi HTML thành công, lệnh SHALL mở file bằng trình mở mặc định của OS qua URL `file://` (hoặc tương đương platform), SHALL NOT khởi HTTP server và SHALL NOT gửi request mạng ra ngoài máy. Nếu mở thất bại, lệnh SHALL báo stderr và thoát mã khác 0 dù file đã ghi.

#### Scenario: --open không tạo server
- **WHEN** chạy `nightowl dashboard --open` với store hợp lệ trong môi trường test có opener giả
- **THEN** opener được gọi với đường dẫn/file URL local; không có process lắng nghe cổng TCP; mã thoát 0 khi opener thành công

### Requirement: HTML self-contained và không CDN
HTML dashboard SHALL self-contained (CSS/JS inline hoặc trong cùng file nếu có), SHALL NOT tải tài nguyên từ URL `http://` hoặc `https://` bên ngoài, và SHALL NOT nhúng telemetry script.

#### Scenario: không CDN ngoài
- **WHEN** chạy `nightowl dashboard` với dữ liệu hợp lệ rồi đọc file HTML
- **THEN** nội dung không chứa `https://` hay `http://` tới host ngoài (ngoài có thể có scheme `file:` nếu được ghi tường minh)

### Requirement: Không lộ danh tính developer
Dashboard SHALL NOT chứa tên người, email, username git author/committer, hay đường dẫn tuyệt đối dưới home người dùng. Chỉ được nêu chỉ số về AI (agent id đã biết trong NightOwl, category, module tương đối, tuần, tỷ lệ sửa, status counts, tín hiệu CI/PR).

#### Scenario: không có author
- **WHEN** database có failure gắn với lần kiểm tra commit có author người thật, rồi chạy `nightowl dashboard`
- **THEN** HTML không chứa tên/email author đó

### Requirement: Không fail-on-rate và không mạng ngầm
`nightowl dashboard` SHALL NOT hỗ trợ `--fail-on-rate`. Flag đó xuất hiện SHALL bị từ chối (strict parse) với lỗi stderr và thoát mã 1. Lệnh SHALL NOT gọi LLM hay gửi telemetry.

#### Scenario: từ chối fail-on-rate
- **WHEN** chạy `nightowl dashboard --fail-on-rate 30`
- **THEN** stderr báo tuỳ chọn không hợp lệ / không hỗ trợ, mã thoát 1

### Requirement: Dashboard hiển thị ước lượng nhiễu
HTML từ `nightowl dashboard` SHALL có section ước lượng nhiễu dùng cùng định nghĩa với `report` (tỷ lệ review-noise khi đủ mẫu, count auto-noise). SHALL NOT lộ tên/email developer. Khi n/a, UI SHALL nói rõ chưa đủ dữ liệu review.

#### Scenario: Section noise trên HTML
- **WHEN** database có confirmed và dismissed rồi chạy `nightowl dashboard`
- **THEN** file HTML gồm nhãn nhiễu / noise và một tỷ lệ phần trăm hoặc n/a

### Requirement: Dashboard top clusters
HTML từ `nightowl dashboard` SHALL có section top clusters dùng cùng định nghĩa với `report` (key/count, sample category hoặc module). SHALL NOT lộ tên/email developer hay secret plaintext. Khi chưa đủ failure để tạo cluster (dưới ngưỡng), section SHALL nói rõ chưa có nhóm hoặc để trống có chú thích — không bịa count.

#### Scenario: Section cluster trên HTML
- **WHEN** database có ≥2 failure cùng cluster rồi chạy `nightowl dashboard`
- **THEN** file HTML gồm nhãn cluster / grouping và count của nhóm đó

### Requirement: Dashboard đếm tín hiệu revert
HTML từ `nightowl dashboard` SHALL hiển thị đếm tín hiệu revert cùng định nghĩa với `report` (trong Signals). SHALL NOT lộ tên/email developer.

#### Scenario: Section signals có revert
- **WHEN** database có ≥1 sự kiện revert rồi chạy `nightowl dashboard`
- **THEN** file HTML gồm nhãn revert (hoặc tương đương) và count > 0

### Requirement: Dashboard tôn trọng coarsen path
Khi bật cờ làm thô path đã document, HTML `nightowl dashboard` SHALL coarsen nhãn module/path trong bảng/tóm tắt theo cùng profile privacy. Secret/email trong text tĩnh SHALL NOT xuất hiện dạng plaintext nếu khớp profile. Cờ tắt → hành vi hiện tại.

#### Scenario: Coarsen trên HTML
- **WHEN** chạy dashboard với coarsen path bật
- **THEN** file HTML không chứa ít nhất một path sâu đầy đủ đã có trong dữ liệu nếu coarsen áp dụng; thoát 0

### Requirement: Dashboard tôn trọng workspace
HTML `nightowl dashboard` SHALL dùng cùng quy tắc module/workspace như `report` khi có discovery, và SHALL chấp nhận `--workspace`. SHALL NOT lộ tên/email developer.

#### Scenario: Filter workspace trên dashboard
- **WHEN** chạy dashboard với `--workspace` hợp lệ trên monorepo fixture
- **THEN** HTML module section chỉ phản ánh workspace đó; mã thoát 0
