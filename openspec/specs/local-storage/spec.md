# local-storage Specification

## Purpose
Lưu sự kiện và bản ghi lỗi của NightOwl trong một file SQLite nằm ngay trong dự án, để dữ liệu không bao giờ rời khỏi máy và mọi lệnh đọc cùng một nguồn.

## Requirements

### Requirement: Vị trí database
NightOwl SHALL lưu dữ liệu trong file `.nightowl/nightowl.db` ở gốc dự án, tức thư mục chứa `.git` gần nhất tính từ thư mục làm việc. Thư mục `.nightowl/` SHALL được tạo khi cần.

#### Scenario: Lần đầu ghi dữ liệu
- **WHEN** NightOwl ghi dữ liệu trong một repo git chưa có `.nightowl/`
- **THEN** file `.nightowl/nightowl.db` được tạo ở gốc repo

#### Scenario: Chạy từ thư mục con
- **WHEN** NightOwl chạy trong `<repo>/src/feature`
- **THEN** dữ liệu được ghi vào `<repo>/.nightowl/nightowl.db`, không tạo `.nightowl/` trong thư mục con

#### Scenario: Ngoài repo git
- **WHEN** NightOwl chạy ở thư mục không thuộc repo git nào
- **THEN** không file nào được tạo và thao tác ghi báo lỗi "không tìm thấy dự án" cho nơi gọi

### Requirement: Schema có phiên bản
Database SHALL mang số phiên bản schema. Khi mở, NightOwl SHALL tự áp mọi migration còn thiếu theo thứ tự, mỗi migration trong một transaction. Mở lại database đã ở phiên bản mới nhất SHALL không thay đổi gì.

#### Scenario: Database mới
- **WHEN** mở một database chưa có bảng nào
- **THEN** bảng `events` và `failures` tồn tại và phiên bản schema là 1

#### Scenario: Mở lại
- **WHEN** mở database đã ở phiên bản 1 lần thứ hai
- **THEN** dữ liệu và phiên bản giữ nguyên

#### Scenario: Database từ bản NightOwl mới hơn
- **WHEN** phiên bản schema trong file lớn hơn phiên bản bản NightOwl đang chạy biết
- **THEN** NightOwl không sửa file và báo lỗi yêu cầu nâng cấp NightOwl

### Requirement: Bảng events
Bảng `events` SHALL lưu mỗi sự kiện với: id tự tăng, thời điểm ghi (UTC, ISO 8601), nguồn (`claude-code` hoặc `git`), loại sự kiện, id phiên nếu có, đường dẫn file tương đối so với gốc dự án nếu có, và payload JSON.

#### Scenario: Ghi rồi đọc lại một sự kiện
- **WHEN** ghi một sự kiện nguồn `claude-code`, loại `edit`, file `src/a.ts`
- **THEN** đọc lại được đúng các trường đó, kèm id và thời điểm ghi

### Requirement: Bảng failures
Bảng `failures` SHALL tồn tại với các cột: id, thời điểm tạo, đường dẫn file, id sự kiện AI gốc, nội dung AI viết, nội dung dev commit, mã commit, loại lỗi (có thể rỗng) và trạng thái.

#### Scenario: Bảng sẵn sàng cho change sau
- **WHEN** schema v1 được tạo
- **THEN** có thể chèn một dòng `failures` với loại lỗi rỗng và trạng thái `flagged`

### Requirement: Ghi đồng thời
Hai tiến trình NightOwl ghi vào cùng database cùng lúc SHALL đều ghi thành công, không mất dòng nào và không báo lỗi database bị khoá, khi mỗi lần ghi ngắn hơn 2 giây.

#### Scenario: Hai hook chạy song song
- **WHEN** hai tiến trình mỗi bên ghi 50 sự kiện cùng lúc
- **THEN** database có đủ 100 sự kiện

### Requirement: Dùng SQLite không in cảnh báo
Mở database SHALL NOT in gì ra stdout hay stderr, kể cả cảnh báo thử nghiệm của Node.js về SQLite.

#### Scenario: Mở database trên Node.js 22.13
- **WHEN** NightOwl mở database trên Node.js 22.13
- **THEN** stderr không có `ExperimentalWarning`

### Requirement: Thư mục dữ liệu riêng tư
Thư mục `.nightowl/` SHALL chỉ cho người dùng hiện tại đọc, ghi và truy cập (quyền `0700`), kể cả khi thư mục đã tồn tại với quyền rộng hơn. Khi `.nightowl` là symlink hoặc không phải thư mục, NightOwl SHALL từ chối dùng nó và không ghi gì.

#### Scenario: Tạo mới
- **WHEN** NightOwl tạo `.nightowl/` lần đầu
- **THEN** thư mục có quyền `0700`

#### Scenario: Repo clone về có .nightowl là symlink
- **WHEN** `.nightowl` là symlink trỏ ra ngoài dự án
- **THEN** mở database báo lỗi và không file nào được tạo ở đích của symlink

### Requirement: Dữ liệu không rời khỏi máy
Lớp lưu trữ SHALL chỉ đọc và ghi file trong `.nightowl/` của dự án và SHALL NOT gửi dữ liệu đi đâu.

#### Scenario: Kiểm tra file bị chạm tới
- **WHEN** ghi một sự kiện
- **THEN** chỉ các file trong `.nightowl/` được tạo hoặc thay đổi (gồm file phụ của SQLite như `-wal`, `-shm`)

### Requirement: Nguồn của bản ghi lỗi
Schema v4 SHALL thêm vào bảng `failures` cột `source` (chỉ nhận `manual-fix` hoặc `ai-self-fix`, mặc định `manual-fix`) và cột `feedback_event_id` trỏ tới sự kiện prompt. Database cũ SHALL được nâng lên v4 khi chạy `nightowl init`, và mọi bản ghi lỗi có sẵn nhận nguồn `manual-fix`.

#### Scenario: Nâng cấp database v3
- **WHEN** database ở v3 có hai bản ghi lỗi và chạy `nightowl init`
- **THEN** `PRAGMA user_version` là 4 và cả hai bản ghi có `source` là `manual-fix`, `feedback_event_id` là `NULL`

#### Scenario: Nguồn không hợp lệ
- **WHEN** ghi một bản ghi lỗi với `source` là `other`
- **THEN** SQLite từ chối bản ghi

### Requirement: Dọn dẹp dữ liệu lưu trữ
`nightowl prune` SHALL hỗ trợ dọn dẹp các snapshot của sự kiện cũ hơn `--days <N>` ngày (mặc định 30 ngày). Với mỗi sự kiện cũ hơn ngưỡng, lệnh SHALL đặt trường `snapshot` trong payload thành `null` và đánh dấu `snapshot_skipped: 'pruned'`. Với `--dry-run`, lệnh chỉ đếm và báo cáo số lượng sự kiện/snapshot sẽ dọn dẹp mà không sửa database. Với `--vacuum`, lệnh SHALL chạy `VACUUM` để thu hồi dung lượng đĩa. Các bản ghi lỗi `failures` SHALL luôn được bảo toàn.

#### Scenario: Dọn dẹp mặc định 30 ngày
- **WHEN** chạy `nightowl prune` trong dự án có các sự kiện cũ hơn 30 ngày kèm snapshot
- **THEN** các sự kiện đó được cập nhật bỏ snapshot, stdout báo số snapshot đã dọn dẹp, và các bản ghi failures giữ nguyên

#### Scenario: Tuỳ chọn số ngày
- **WHEN** chạy `nightowl prune --days 7`
- **THEN** chỉ các sự kiện cũ hơn 7 ngày bị dọn dẹp snapshot

#### Scenario: Chế độ dry-run
- **WHEN** chạy `nightowl prune --dry-run`
- **THEN** stdout báo số lượng snapshot sẽ dọn dẹp, database không thay đổi, mã thoát là 0

#### Scenario: Tuỳ chọn vacuum
- **WHEN** chạy `nightowl prune --vacuum`
- **THEN** lệnh dọn dẹp snapshot và thực thi VACUUM thành công để thu hồi dung lượng đĩa

#### Scenario: Tham số không hợp lệ
- **WHEN** chạy `nightowl prune --days abc` hoặc `nightowl prune --days 0`
- **THEN** lệnh báo lỗi ra stderr và thoát mã 1

### Requirement: Cột agent trên events
Schema mới SHALL thêm cột `agent` (TEXT, có thể null cho sự kiện `git` thuần) trên `events`, với CHECK hoặc validation ứng dụng theo danh sách agent hỗ trợ cộng `unknown`. Migration SHALL chạy tự động khi `nightowl init` / mở store ghi.

#### Scenario: Migration từ bản cũ
- **WHEN** mở DB chỉ có source `claude-code`/`git` không có cột agent
- **THEN** migration thêm cột; sự kiện `claude-code` cũ nhận `agent='claude-code'`; sự kiện `git` nhận `agent` null

### Requirement: Agent trên failures khi có snapshot
Khi tạo failure từ snapshot agent, bản ghi SHALL lưu `agent` của edit AI tương ứng để report/filter.

#### Scenario: Failure từ Cursor
- **WHEN** post-commit tạo failure từ edit `cursor`
- **THEN** hàng `failures` có `agent` là `cursor`

### Requirement: Sự kiện CI và PR trên events
Schema SHALL cho phép lưu sự kiện với loại (hoặc kind) đại diện CI fail và PR review, kèm payload JSON (test name, message, path, commit SHA, comment body đã cắt, …). Migration SHALL chạy tự động khi mở store ghi / `init`. Nguồn sự kiện MAY dùng giá trị đã document (ví dụ `ci` / `pr`) khác `claude-code`/`git` nếu cần — validation ứng dụng hoặc CHECK cập nhật tương ứng.

#### Scenario: Ghi sự kiện CI rồi đọc lại
- **WHEN** ghi một sự kiện CI fail với file `src/a.ts` và payload có `test_name`
- **THEN** đọc lại được đúng kind/source/file/payload đã document

#### Scenario: Migration DB cũ
- **WHEN** mở DB schema trước migration này bằng bản NightOwl mới
- **THEN** migration áp dụng; DB cũ vẫn đọc được; có thể ghi sự kiện CI/PR mới

### Requirement: Lưu bản ghi rule applied và baseline
Schema SHALL cho phép lưu bản ghi áp dụng rule với: nhãn/id, thời điểm áp dụng (UTC ISO), bộ lọc (category/module/agent khi có), và snapshot baseline JSON (số đếm failure tại thời điểm mark). Migration SHALL chạy tự động khi mở store ghi / `init`. Dữ liệu SHALL chỉ nằm trong `.nightowl/` local.

#### Scenario: Ghi rồi đọc lại
- **WHEN** ghi một bản ghi applied với label `r1` và baseline `{ "total": 3 }`
- **THEN** đọc lại được đúng label, thời điểm, và baseline đã document

#### Scenario: Migration DB cũ
- **WHEN** mở DB schema trước migration này bằng bản NightOwl mới
- **THEN** migration áp dụng; có thể ghi bản ghi applied mới

### Requirement: Schema noise trên failures
Migration schema mới SHALL thêm vào bảng `failures` cột `noise_score` (REAL NULL hoặc 0–1) và `noise_reasons` (TEXT, mặc định rỗng). Database cũ SHALL được nâng cấp khi mở store / `nightowl init` mà không mất bản ghi.

#### Scenario: Migration giữ failures cũ
- **WHEN** mở DB trước migration bằng bản NightOwl mới rồi đọc failures cũ
- **THEN** các hàng cũ vẫn đọc được; `noise_score` NULL hoặc mặc định an toàn; `noise_reasons` rỗng

### Requirement: Lưu thống kê học nhiễu local
Schema SHALL có chỗ lưu thống kê học nhiễu local (bảng riêng hoặc cấu trúc tương đương trong DB dự án) gồm ít nhất: reason/fingerprint key, số dismiss, số confirm, cập nhật lần cuối. Dữ liệu SHALL ở `.nightowl/` local và SHALL NOT được gửi đi.

#### Scenario: Bảng hoặc store học tồn tại sau init
- **WHEN** chạy `nightowl init` / mở store ở schema mới
- **THEN** có thể ghi và đọc một bản đếm dismiss/confirm theo key học

### Requirement: Sự kiện revert trên events
Schema/store SHALL cho phép ghi sự kiện với `source` phù hợp đã document (ví dụ `git`) và `kind` = `revert` (hoặc tương đương), kèm payload JSON (reverted commit SHA, revert commit SHA, failure_id khi có). `dedupe_key` UNIQUE khi có SHALL hỗ trợ idempotent ingest. Migration SHALL chạy tự động nếu cần mở rộng CHECK; nếu kind không bị CHECK cứng thì không bắt buộc migration.

#### Scenario: Ghi rồi đọc lại revert
- **WHEN** ghi một sự kiện revert với dedupe_key `revert:<sha>` rồi đọc theo kind
- **THEN** đọc lại được đúng kind/source/payload; lần ghi trùng dedupe không tạo hàng thứ hai
