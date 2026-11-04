# eval-export Specification

## Purpose
Biến mỗi bản ghi lỗi thành một bài test (đầu vào, code đúng, tiêu chí chấm) trong một file JSONL nằm trên máy, để chạy lại với các model khác nhau.

## Requirements

### Requirement: Xuất bộ test JSONL
`nightowl export` SHALL ghi một dòng JSON cho mỗi bản ghi lỗi không bị `dismissed`, theo thứ tự tạo, với các trường: `schema` (bằng `nightowl.eval/v1`), `id`, `file_path`, `commit_sha`, `created_at`, `input.prompt`, `input.file_before`, `rejected`, `expected`, `category`, `category_reason`, `category_confidence`, `criteria`. Sau khi ghi, lệnh SHALL in ra stderr số bài test và đường dẫn file, rồi thoát mã 0.

#### Scenario: Hai lỗi
- **WHEN** database có 2 bản ghi lỗi và chạy `nightowl export`
- **THEN** `.nightowl/export/evals.jsonl` có đúng 2 dòng, mỗi dòng là JSON hợp lệ với `schema` bằng `nightowl.eval/v1`, `rejected` là bản AI viết và `expected` là bản dev commit

#### Scenario: Lỗi bị loại
- **WHEN** một bản ghi lỗi có trạng thái `dismissed`
- **THEN** bản ghi đó không có trong file xuất

#### Scenario: Chưa có lỗi
- **WHEN** database chưa có bản ghi lỗi nào
- **THEN** file xuất rỗng và stderr báo đã xuất 0 bài test, mã thoát 0

### Requirement: Đầu vào gồm file trước commit
`input.file_before` SHALL là nội dung file tại commit cha của `commit_sha`, đọc từ git trên máy. Khi file chưa tồn tại ở commit cha, commit không còn trong repo, nội dung lớn hơn 512 KB, hoặc nội dung không phải văn bản UTF-8 (file nhị phân), `input.file_before` SHALL là `null`. `input.prompt` SHALL là prompt gắn với bản ghi lỗi, hoặc `null`.

#### Scenario: File có sẵn trước đó
- **WHEN** file `src/a.ts` đã có ở commit cha với nội dung `v0`, AI viết `v1`, dev commit `v2`
- **THEN** bài test có `input.file_before` bằng `v0`, `rejected` bằng `v1`, `expected` bằng `v2`

#### Scenario: File mới
- **WHEN** commit có lỗi là commit tạo ra file đó
- **THEN** `input.file_before` là `null`

### Requirement: Định danh ổn định
`id` SHALL được dựng từ mã commit và số của bản ghi lỗi, chỉ phụ thuộc vào chính bản ghi đó, để xuất lại (kể cả với bộ lọc khác, hay sau khi có bản ghi khác bị loại) luôn cho cùng `id`.

#### Scenario: Xuất hai lần
- **WHEN** chạy `nightowl export` hai lần không có lỗi mới
- **THEN** hai file giống hệt nhau

#### Scenario: Xuất với bộ lọc khác
- **WHEN** một bản ghi lỗi có trong cả lần xuất đầy đủ và lần xuất `--category convention`
- **THEN** `id` của nó giống nhau ở hai lần

### Requirement: Ghi file an toàn
Mặc định lệnh SHALL ghi vào `.nightowl/export/evals.jsonl`. File xuất SHALL được tạo với quyền chỉ chủ sở hữu đọc ghi, ghi nguyên tử (không để lại file dở khi lỗi), và SHALL NOT ghi xuyên symlink. Lệnh SHALL NOT thay thế một file có sẵn không phải file xuất trước đó của NightOwl, trừ khi có `--force`. Khi git không bỏ qua file đích, lệnh SHALL cảnh báo trên stderr. Với `--out -`, lệnh SHALL in JSONL ra stdout và không tạo file.

#### Scenario: Đích là file khác
- **WHEN** chạy `nightowl export --out notes.txt` và `notes.txt` là ghi chú của người dùng
- **THEN** lệnh báo lỗi gợi ý `--force`, thoát mã 1, `notes.txt` không đổi

#### Scenario: Đích là symlink
- **WHEN** `--out` trỏ tới một symlink
- **THEN** lệnh báo lỗi, thoát mã 1, file mà symlink trỏ tới không đổi

### Requirement: Không xuất file nhạy cảm
Lệnh SHALL NOT xuất bản ghi lỗi của file có tên thuộc nhóm bí mật (cùng quy tắc với hook Claude Code: `.env*`, khoá, `credentials`, …), kể cả khi database có sẵn bản ghi đó, và SHALL báo trên stderr số bản ghi đã bỏ.

#### Scenario: Bản ghi lỗi của .env
- **WHEN** database có một bản ghi lỗi cho `.env`
- **THEN** file xuất không có bản ghi đó và stderr báo đã bỏ 1 bản ghi nhạy cảm

### Requirement: Lọc khi xuất
Với `--since <YYYY-MM-DD>`, lệnh SHALL chỉ xuất bản ghi lỗi tạo từ 00:00 UTC ngày đó. Với một hoặc nhiều `--category <loại>`, lệnh SHALL chỉ xuất bản ghi thuộc các loại đó; giá trị `unclassified` chọn bản ghi chưa có loại. Giá trị không hợp lệ SHALL làm lệnh báo lỗi và thoát mã 1 mà không ghi file.

#### Scenario: Chỉ lỗi logic
- **WHEN** chạy `nightowl export --category logic` với 2 lỗi `logic` và 1 lỗi `convention`
- **THEN** file xuất có 2 dòng

### Requirement: Chỉ đọc dữ liệu, không tự khởi tạo
`nightowl export` SHALL mở database chỉ đọc và SHALL NOT thay đổi hay nâng cấp nó; database cũ hơn phiên bản hiện tại SHALL làm lệnh gợi ý `nightowl init` và thoát mã 1. Khi dự án chưa có `.nightowl/nightowl.db`, lệnh SHALL báo cần chạy `nightowl init`, thoát mã 1 và SHALL NOT tạo file hay thư mục nào. Ngoài repo git, lệnh SHALL báo lỗi và thoát mã 1.

#### Scenario: Chưa chạy init
- **WHEN** chạy `nightowl export` trong một repo git chưa có `.nightowl/`
- **THEN** stderr gợi ý `nightowl init`, mã thoát 1, không có `.nightowl/` được tạo
