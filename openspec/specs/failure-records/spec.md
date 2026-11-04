# failure-records Specification

## Purpose
Biến kết quả kiểm tra lúc commit thành bản ghi lỗi gọn (prompt, bản AI viết, bản dev commit, mã commit), chỉ cho những commit thật sự diễn ra, làm đầu vào cho phân loại, báo cáo và bộ test.

## Requirements

### Requirement: Tạo bản ghi lỗi sau khi commit
Khi chạy `nightowl postcommit`, với mỗi `commit-check` kết quả `modified`, không phải chỉ khác khoảng trắng, chưa được xử lý, và file đó trong `HEAD` có đúng blob đã kiểm tra, NightOwl SHALL tạo một bản ghi `failures` với: đường dẫn file, sự kiện AI mới nhất, nội dung AI viết, nội dung dev commit, mã commit `HEAD`, trạng thái `flagged`, loại lỗi để trống.

#### Scenario: Dev sửa code AI rồi commit
- **WHEN** AI ghi `src/a.ts`, dev sửa rồi commit thành công
- **THEN** có đúng một bản ghi `failures` cho `src/a.ts` với `commit_sha` bằng `HEAD`, `ai_content` là bản AI viết, `final_content` là bản đã commit

#### Scenario: Dev giữ nguyên code AI
- **WHEN** `commit-check` của file có kết quả `unchanged`
- **THEN** không có bản ghi `failures` nào cho file đó

#### Scenario: Chỉ khác khoảng trắng
- **WHEN** `commit-check` có `whitespace_only` bằng true
- **THEN** không có bản ghi `failures` nào cho file đó

### Requirement: Commit bị huỷ không sinh lỗi
Một `commit-check` mà file tương ứng trong `HEAD` không có đúng blob đã kiểm tra SHALL NOT sinh bản ghi `failures`. Mỗi `commit-check` SHALL được xử lý nhiều nhất một lần.

#### Scenario: Commit bị huỷ ở bước nhập message
- **WHEN** `pre-commit` đã ghi `commit-check` `modified` nhưng commit bị huỷ, rồi dev commit lại với nội dung khác
- **THEN** bản ghi `failures` (nếu có) chỉ ứng với commit thật sự được tạo

#### Scenario: Chạy postcommit hai lần
- **WHEN** `nightowl postcommit` chạy hai lần sau cùng một commit
- **THEN** số bản ghi `failures` không đổi sau lần thứ hai

### Requirement: Gắn prompt gây ra lỗi
Bản ghi `failures` SHALL tham chiếu sự kiện `prompt` gần nhất của cùng phiên Claude Code xảy ra trước lần AI sửa đầu tiên được tính trong `commit-check`. Khi không có prompt phù hợp, tham chiếu SHALL để trống.

#### Scenario: Có prompt trong phiên
- **WHEN** người dùng gửi prompt "thêm validate email", AI sửa `src/a.ts` trong cùng phiên, dev sửa lại rồi commit
- **THEN** bản ghi `failures` tham chiếu sự kiện prompt đó

#### Scenario: Prompt của phiên khác
- **WHEN** prompt gần nhất thuộc một phiên khác với phiên AI sửa file
- **THEN** bản ghi `failures` không tham chiếu prompt đó

### Requirement: postcommit không làm phiền git
`nightowl postcommit` SHALL luôn thoát mã 0, không in gì ra stdout hay stderr, không tạo `.nightowl/` nếu chưa có, và dừng sau 2 giây. Lỗi SHALL chỉ được ghi vào `.nightowl/nightowl.log`.

#### Scenario: Database hỏng
- **WHEN** `.nightowl/nightowl.db` không phải file SQLite hợp lệ và dev commit
- **THEN** commit thành công, không có gì in ra terminal, `.nightowl/nightowl.log` có một dòng lỗi

### Requirement: Đếm bản ghi lỗi
`nightowl failures` SHALL in ra stdout tổng số bản ghi lỗi và số theo từng trạng thái, rồi thoát mã 0. Ngoài repo git, lệnh SHALL báo lỗi và thoát mã 1.

#### Scenario: Có 3 lỗi
- **WHEN** database có 3 bản ghi `failures` trạng thái `flagged`
- **THEN** stdout có tổng `3` và `flagged: 3`

### Requirement: Lỗi AI tự sửa theo phản hồi
Khi commit-check khớp HEAD có bản bị phản hồi, và database xác nhận prompt phản hồi là prompt cùng phiên nằm giữa lần sửa đó và một lần AI sửa file sau nó, post-commit SHALL tạo một bản ghi lỗi nguồn `ai-self-fix`: nội dung AI là ảnh chụp bản bị phản hồi, nội dung cuối là bản commit, kèm prompt ban đầu và prompt phản hồi. Mỗi file trong mỗi commit có tối đa một lỗi `ai-self-fix`. Lỗi sửa tay (`manual-fix`) vẫn được tạo như trước, và có thể cùng tồn tại.

#### Scenario: AI sửa đúng sau phản hồi, dev không sửa tay
- **WHEN** AI ghi `age > 18`, dev phản hồi, AI sửa thành `age >= 18`, dev commit đúng bản đó
- **THEN** có đúng một bản ghi lỗi, nguồn `ai-self-fix`, với `ai_content` chứa `age > 18`, `final_content` chứa `age >= 18`, và `feedback_event_id` trỏ tới prompt phản hồi

#### Scenario: Phản hồi chỉ để thêm code
- **WHEN** AI viết một hàm, dev nhắn "thêm hàm kiểm tra email", AI chỉ thêm dòng mới, rồi dev commit
- **THEN** không có bản ghi lỗi nào được tạo

#### Scenario: AI sửa sau phản hồi, dev còn sửa tay
- **WHEN** AI sửa lại sau phản hồi, rồi dev sửa tay thêm một dòng khác trước khi commit
- **THEN** có hai bản ghi lỗi cho file đó: một `ai-self-fix` và một `manual-fix`

#### Scenario: Dev xoá dòng, AI chỉ thêm
- **WHEN** AI viết ba dòng, dev nhắn "thêm dòng d", AI chỉ thêm dòng d, rồi dev tự xoá một dòng cũ và commit
- **THEN** chỉ có một bản ghi lỗi, nguồn `manual-fix`

#### Scenario: Payload trỏ sai prompt
- **WHEN** `feedback_event_id` trong commit-check trỏ tới một prompt của phiên khác
- **THEN** không có lỗi `ai-self-fix` nào được tạo

#### Scenario: Commit không mang bản đã kiểm tra
- **WHEN** check có bản bị phản hồi nhưng blob được stage không phải blob trong HEAD
- **THEN** không có lỗi `ai-self-fix` nào được tạo từ check đó
