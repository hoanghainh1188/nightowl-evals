# shell-completion Specification

## Purpose

Cho phép người dùng sinh script tab-completion cho Bash, Zsh hoặc Fish từ lệnh `nightowl completion`, để gợi ý subcommand và flag ngay trên terminal mà không thêm dependency.

## Requirements

### Requirement: Lệnh completion theo shell
`nightowl completion <shell>` SHALL chấp nhận `shell` là `bash`, `zsh`, hoặc `fish` (không phân biệt hoa thường nếu design chọn normalize). Lệnh SHALL in script completion tương ứng ra stdout rồi thoát mã 0. Không đối số hoặc shell không hỗ trợ SHALL báo lỗi trên stderr và thoát mã 1.

#### Scenario: Bash
- **WHEN** chạy `nightowl completion bash`
- **THEN** stdout chứa script Bash completion; mã thoát 0

#### Scenario: Shell không hỗ trợ
- **WHEN** chạy `nightowl completion powershell`
- **THEN** stderr nêu shell không hỗ trợ và gợi ý `bash|zsh|fish`; mã thoát 1; stdout rỗng hoặc không phải script hợp lệ

### Requirement: Gợi ý subcommand đã đăng ký
Script completion SHALL gợi ý tên mọi lệnh con NightOwl đã đăng ký (ít nhất gồm `init`, `doctor`, `prune`, `report`, `review`, `classify`, `eval`, `export`, `uninstall`, `completion` và các lệnh khác trong registry hiện tại) khi người dùng tab sau `nightowl`.

#### Scenario: Danh sách lệnh trong script
- **WHEN** lấy stdout của `nightowl completion zsh`
- **THEN** nội dung chứa các tên lệnh đã đăng ký (ví dụ `report`, `export`, `completion`)

### Requirement: Gợi ý flag theo lệnh
Script SHALL gợi ý các tuỳ chọn tài liệu hoá của từng lệnh (ví dụ `export` có `--format`, `--out`; `report` có `--fail-on-rate`, `--json`) khi tab sau tên lệnh. Ít nhất các flag dài dạng `--…` xuất hiện trong help của lệnh đó SHALL có trong completion data.

#### Scenario: Flag export
- **WHEN** xem script từ `nightowl completion bash`
- **THEN** nội dung liên quan `export` chứa `--format` và `--out`

### Requirement: Không mạng và không tự ghi file
`nightowl completion` SHALL NOT mở kết nối mạng và SHALL NOT tạo/sửa file trên đĩa; chỉ in ra stdout (user tự redirect nếu muốn).

#### Scenario: Chỉ stdout
- **WHEN** chạy `nightowl completion fish` trong thư mục sạch
- **THEN** không file mới ngoài những gì user/redirect tạo; mã thoát 0

### Requirement: Completion gợi ý lệnh ingest
Script `nightowl completion` SHALL gợi ý tên lệnh ingest CI và ingest PR đã đăng ký, kèm các flag chính (`--file`, và cờ opt-in GitHub nếu có) trong catalog completion.

#### Scenario: Tên lệnh trong script
- **WHEN** lấy stdout `nightowl completion bash`
- **THEN** nội dung có tên lệnh ingest CI và ingest PR

### Requirement: Completion gợi ý lệnh rule-impact
Script `nightowl completion` SHALL gợi ý tên lệnh rule-impact đã đăng ký, kèm flag chính (`--label`, `--category`, `--json`, và subcommand mark/show nếu có) trong catalog completion.

#### Scenario: Tên lệnh trong script
- **WHEN** lấy stdout `nightowl completion bash`
- **THEN** nội dung có tên lệnh rule-impact

### Requirement: Completion gợi ý --write và --output cho suggest-rules
Script `nightowl completion` SHALL gợi ý cả `--write` và `--output` (và `--force` nếu có trong help) cho lệnh `suggest-rules`, phản ánh hai chế độ ghi riêng biệt chứ không gộp thành một alias ẩn.

#### Scenario: Flag ghi trong script
- **WHEN** lấy stdout `nightowl completion bash`
- **THEN** nội dung có `--write` và `--output` gắn với ngữ cảnh `suggest-rules` (hoặc trong catalog flag của lệnh đó)

### Requirement: Completion cho customer-report
Catalog completion SHALL gồm subcommand `customer-report` và các flag tài liệu hoá của lệnh đó (ít nhất `--lang`, `--format`, `--since`, `--depth`, `--agent`, `--output`, `-o`). Script Bash/Zsh/Fish sinh từ catalog SHALL gợi ý các mục này khi tab sau `nightowl` / `nightowl customer-report`.

#### Scenario: catalog có customer-report
- **WHEN** kiểm tra catalog completion của package
- **THEN** có khóa/entry `customer-report` kèm các flag `--lang` và `--format`

### Requirement: Completion cho dashboard
Catalog completion SHALL gồm subcommand `dashboard` và các flag tài liệu hoá của lệnh đó (ít nhất `--since`, `--depth`, `--agent`, `--output`, `-o`, `--open`). Script Bash/Zsh/Fish sinh từ catalog SHALL gợi ý các mục này khi tab sau `nightowl` / `nightowl dashboard`.

#### Scenario: catalog có dashboard
- **WHEN** kiểm tra catalog completion của package
- **THEN** có khóa/entry `dashboard` kèm các flag `--output` và `--open`

### Requirement: Completion cho digest
Catalog completion SHALL gồm lệnh `digest` và các flag dài đã document cho lệnh đó (ít nhất `--since`, `--format`, `--output` hoặc tương đương).

#### Scenario: Catalog có digest
- **WHEN** dựng catalog completion từ registry lệnh
- **THEN** có mục `digest` với danh sách flag không rỗng gồm ít nhất một flag thời gian/định dạng

### Requirement: Completion flag privacy
Catalog completion SHALL gồm các flag privacy mới trên `export` (ít nhất `--redact-paths` và `--privacy-dry-run` hoặc tên đã document), và flag coarsen path trên các lệnh báo cáo nếu chúng hỗ trợ.

#### Scenario: Catalog export có redact-paths
- **WHEN** dựng catalog completion
- **THEN** entry `export` gồm flag privacy đã document
