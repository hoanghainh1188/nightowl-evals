# git-hook Specification

## Purpose
So code AI viết với code dev thật sự commit, ngay lúc commit, và lưu kết quả cho từng file để các change sau dựng bản ghi lỗi, mà không bao giờ làm chậm hay chặn commit.

## Requirements

### Requirement: Kiểm tra file AI đã sửa
Khi chạy `nightowl precommit`, với mỗi file staged (thêm mới hoặc sửa) có sự kiện `edit` kèm ảnh chụp chưa được kiểm tra, NightOwl SHALL so nội dung staged với ảnh chụp mới nhất của file đó và lưu một sự kiện nguồn `git`, loại `commit-check`, tham chiếu tới sự kiện `edit` đó.

#### Scenario: Dev giữ nguyên code AI
- **WHEN** AI ghi `src/a.ts`, dev stage đúng file đó không sửa gì rồi commit
- **THEN** có một sự kiện `commit-check` cho `src/a.ts` với kết quả `unchanged`

#### Scenario: Dev sửa code AI
- **WHEN** AI ghi `src/a.ts`, dev sửa 3 dòng rồi commit
- **THEN** có một sự kiện `commit-check` cho `src/a.ts` với kết quả `modified`, số dòng thêm và bớt khác 0, và nội dung staged

#### Scenario: File AI không đụng tới
- **WHEN** dev commit `README.md` mà không có sự kiện `edit` nào cho file đó
- **THEN** không có sự kiện `commit-check` nào cho `README.md`

#### Scenario: Git coi file AI viết là đổi tên
- **WHEN** AI ghi `new.ts` gần giống `old.ts`, `old.ts` bị xoá, và git nhận ra cặp này là đổi tên
- **THEN** `new.ts` vẫn được kiểm tra như một file thêm mới

### Requirement: Không so với ảnh chụp cũ
Khi sự kiện `edit` mới nhất của một file không có ảnh chụp (file quá lớn, không đọc được, nhạy cảm hoặc bị git bỏ qua), NightOwl SHALL NOT so với ảnh chụp của sự kiện cũ hơn, mà SHALL lưu `commit-check` với kết quả `skipped`, lý do `no_snapshot`, và đánh dấu mọi sự kiện `edit` đó là đã được tính.

#### Scenario: Lần sửa mới nhất quá lớn
- **WHEN** AI ghi `src/a.ts` (có ảnh chụp), rồi ghi lại với nội dung > 512 KB (không có ảnh chụp), rồi dev commit
- **THEN** `commit-check` của `src/a.ts` có kết quả `skipped` và tham chiếu cả hai sự kiện `edit`

### Requirement: Mỗi lần AI sửa chỉ kiểm tra một lần
Sự kiện `edit` đã có `commit-check` tham chiếu SHALL NOT được kiểm tra lại ở các commit sau. Một `commit-check` SHALL dùng ảnh chụp mới nhất của file và đánh dấu mọi sự kiện `edit` cũ hơn chưa kiểm tra của cùng file là đã được tính.

#### Scenario: Commit lần hai
- **WHEN** commit chứa `src/a.ts` đã được kiểm tra, rồi dev sửa tay `src/a.ts` và commit lần nữa mà AI không sửa thêm
- **THEN** commit thứ hai không tạo `commit-check` mới cho `src/a.ts`

#### Scenario: AI sửa nhiều lần trước khi commit
- **WHEN** AI sửa `src/a.ts` ba lần rồi dev commit
- **THEN** có đúng một `commit-check`, so với ảnh chụp của lần sửa thứ ba, và tham chiếu cả ba sự kiện `edit`

### Requirement: Đánh dấu thay đổi chỉ về khoảng trắng
Khi nội dung staged chỉ khác ảnh chụp ở khoảng trắng, sự kiện `commit-check` SHALL có kết quả `modified` và cờ `whitespace_only` bằng true.

#### Scenario: Dev chỉ chạy formatter
- **WHEN** dev chỉ đổi thụt lề trong file AI viết rồi commit
- **THEN** sự kiện `commit-check` có `whitespace_only` bằng true

### Requirement: Không chặn commit
`nightowl precommit` SHALL luôn thoát mã 0 và không in gì ra stdout hay stderr, kể cả khi không có database, git lỗi, hay ghi database thất bại. Lỗi SHALL chỉ được ghi vào `.nightowl/nightowl.log` khi thư mục `.nightowl/` đã tồn tại.

#### Scenario: Chưa từng chạy init
- **WHEN** chạy `nightowl precommit` trong repo chưa có `.nightowl/`
- **THEN** mã thoát 0, stdout và stderr rỗng, không file nào được tạo

#### Scenario: Database hỏng
- **WHEN** `.nightowl/nightowl.db` không phải file SQLite hợp lệ và dev commit
- **THEN** commit vẫn thành công và `.nightowl/nightowl.log` có một dòng lỗi

### Requirement: Kiểm tra nhanh
`nightowl precommit` SHALL dừng kiểm tra sau 2 giây: các file đã kiểm tra được giữ lại, phần còn lại bỏ qua, và lệnh thoát mã 0.

#### Scenario: Commit lớn
- **WHEN** commit có 500 file AI đã sửa
- **THEN** lệnh thoát mã 0 trong vòng 3 giây

### Requirement: Không lưu thông tin người
Sự kiện `commit-check` SHALL NOT chứa tên, email hay định danh của tác giả commit.

#### Scenario: Kiểm tra payload
- **WHEN** đọc một sự kiện `commit-check` bất kỳ
- **THEN** payload không có tên hay email lấy từ cấu hình git

### Requirement: Ghi nhận bản AI bị phản hồi
Pre-commit SHALL tìm *bản bị phản hồi* của mỗi file: lần AI sửa mà sau nó, trong cùng phiên Claude Code, dev gửi một prompt rồi AI sửa lại file đó và bỏ hoặc đổi ít nhất một dòng của lần sửa ấy (so với bản AI sau cùng, không chỉ khác khoảng trắng). Lần sửa của phiên khác xen giữa, và lần sửa của một commit bị huỷ trước đó, vẫn được xét. Có nhiều thì lấy lần sớm nhất. Commit-check SHALL ghi id lần sửa, id prompt phản hồi và số dòng AI thêm, bỏ.

#### Scenario: AI sửa lại sau phản hồi
- **WHEN** trong một phiên, AI ghi `age > 18`, dev gửi prompt "sai rồi, từ 18", AI sửa thành `age >= 18`, rồi dev stage file và commit
- **THEN** commit-check của file ghi bản bị phản hồi là lần sửa đầu, prompt phản hồi là prompt thứ hai, và có 1 dòng bị bỏ

#### Scenario: AI chỉnh nhiều lần trong một lượt
- **WHEN** AI sửa một file hai lần liên tiếp mà không có prompt nào của dev ở giữa
- **THEN** commit-check không có bản bị phản hồi

#### Scenario: Prompt ở phiên khác
- **WHEN** giữa hai lần AI sửa một file ở phiên A, chỉ có prompt ở phiên B
- **THEN** commit-check không có bản bị phản hồi

#### Scenario: Phiên khác sửa xen giữa
- **WHEN** phiên A sửa file, phiên B sửa file, dev gửi prompt ở phiên A, rồi phiên A sửa lại và đổi dòng nó đã viết
- **THEN** commit-check ghi bản bị phản hồi là lần sửa đầu của phiên A

#### Scenario: Commit trước bị huỷ
- **WHEN** AI sửa, dev phản hồi, AI sửa lại, dev commit nhưng commit bị huỷ, AI sửa thêm, rồi dev commit lại
- **THEN** commit-check của lần commit sau vẫn ghi bản bị phản hồi là lần sửa đầu

#### Scenario: Chỉ dev xoá dòng
- **WHEN** AI viết ba dòng, dev nhắn "thêm dòng d", AI chỉ thêm dòng d, rồi dev tự xoá một dòng cũ trước khi commit
- **THEN** commit-check không có bản bị phản hồi
