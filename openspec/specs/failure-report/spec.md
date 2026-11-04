# failure-report Specification

## Purpose
Cho người dùng thấy AI hay sai kiểu gì, ở module nào, và xu hướng theo tuần, từ dữ liệu NightOwl đã ghi trên máy.

## Requirements

### Requirement: Báo cáo theo loại, module, tuần
`nightowl report` SHALL in ra stdout: tổng số bản ghi lỗi không bị `dismissed`, số lỗi theo từng loại (`logic`, `convention`, `misread-requirement`, `missing-context`, và chưa phân loại), số lỗi theo module, và số lỗi theo tuần ISO, rồi thoát mã 0.

#### Scenario: Có lỗi đã phân loại
- **WHEN** database có 3 lỗi `logic` trong `src/hooks/`, 1 lỗi `convention` trong `src/cli/` và 1 lỗi chưa phân loại
- **THEN** stdout có tổng `5`, `logic` là `3`, `convention` là `1`, chưa phân loại là `1`, module `src/hooks` là `3`, `src/cli` là `1`

#### Scenario: Lỗi bị loại
- **WHEN** một bản ghi lỗi có trạng thái `dismissed`
- **THEN** bản ghi đó không được tính vào bất kỳ con số nào, và stdout cho biết số lỗi bị loại

#### Scenario: Chưa có lỗi nào
- **WHEN** database chưa có bản ghi lỗi nào
- **THEN** stdout nói chưa có lỗi nào được ghi, mã thoát 0

### Requirement: Tỷ lệ code AI bị sửa
Báo cáo SHALL có tỷ lệ code AI bị dev sửa: số lần kiểm tra lúc commit sinh ra lỗi chia cho số lần kiểm tra đã được xử lý sau commit (không tính lần bị thay thế), cả tổng và theo từng tuần. Khi chưa có lần kiểm tra nào, tỷ lệ SHALL hiện là không có dữ liệu thay vì 0%.

#### Scenario: 4 lần kiểm tra, 1 lỗi
- **WHEN** 4 lần kiểm tra đã xử lý sau commit, 1 lần thành lỗi, 3 lần không
- **THEN** stdout có tỷ lệ `25%`

### Requirement: Module là thư mục của file
Module SHALL là `--depth` cấp thư mục đầu tiên của đường dẫn file (mặc định 2). File nằm ở gốc dự án SHALL thuộc module `(root)`. Bản dạng chữ SHALL chỉ in 10 module nhiều lỗi nhất và 8 tuần gần nhất; bản `--json` SHALL có đủ.

#### Scenario: Độ sâu 1
- **WHEN** chạy `nightowl report --depth 1` với lỗi ở `src/hooks/git/a.ts` và `README.md`
- **THEN** module là `src` và `(root)`

### Requirement: Lọc theo ngày và xuất JSON
Với `--since <YYYY-MM-DD>`, báo cáo SHALL chỉ tính bản ghi lỗi và lần kiểm tra tạo từ 00:00 UTC ngày đó. Với `--json`, stdout SHALL là một object JSON hợp lệ chứa cùng các số liệu. Giá trị tuỳ chọn không hợp lệ SHALL làm lệnh báo lỗi và thoát mã 1.

#### Scenario: Ngày sai định dạng
- **WHEN** chạy `nightowl report --since 04/11/2026`
- **THEN** stderr báo ngày không hợp lệ, mã thoát 1

### Requirement: Chỉ đọc, không tự khởi tạo
`nightowl report` SHALL mở database chỉ đọc và SHALL NOT thay đổi hay nâng cấp nó; database cũ hơn phiên bản hiện tại SHALL làm lệnh gợi ý `nightowl init` và thoát mã 1. Khi dự án chưa có `.nightowl/nightowl.db`, lệnh SHALL báo cần chạy `nightowl init`, thoát mã 1 và SHALL NOT tạo file hay thư mục nào. Ngoài repo git, lệnh SHALL báo lỗi và thoát mã 1.

#### Scenario: Chưa chạy init
- **WHEN** chạy `nightowl report` trong một repo git chưa có `.nightowl/`
- **THEN** stderr gợi ý `nightowl init`, mã thoát 1, không có `.nightowl/` được tạo

### Requirement: Đếm lỗi theo nguồn
`nightowl report` SHALL in số lỗi theo nguồn (`manual-fix`, `ai-self-fix`), không tính lỗi `dismissed`. Bản `--json` SHALL có `by_source` với đủ hai khoá, kể cả khi bằng 0.

#### Scenario: Có cả hai nguồn
- **WHEN** database có 2 lỗi `manual-fix` và 1 lỗi `ai-self-fix`, rồi chạy `nightowl report --json`
- **THEN** `by_source` là `{"manual-fix": 2, "ai-self-fix": 1}`

### Requirement: Đếm theo trạng thái xem lại
`nightowl report` SHALL in số lỗi `confirmed`, `dismissed` và `flagged`. Bản `--json` SHALL có `by_status` với đủ ba khoá. Tổng số lỗi và các mục khác vẫn không tính lỗi `dismissed`.

#### Scenario: Đã xem một phần
- **WHEN** có 2 lỗi `confirmed`, 1 `dismissed` và 3 `flagged`, rồi chạy `nightowl report --json`
- **THEN** `by_status` là `{"confirmed": 2, "dismissed": 1, "flagged": 3}` và `total` là 5
