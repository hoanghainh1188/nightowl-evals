## MODIFIED Requirements

### Requirement: Đăng ký hook Claude Code
`nightowl init` SHALL đăng ký một hook `PostToolUse` matcher `Edit|Write|MultiEdit` và một hook `UserPromptSubmit`, cả hai chạy `command -v nightowl >/dev/null 2>&1 && nightowl log >/dev/null 2>&1 || true`. File đích là `.claude/settings.local.json`, hoặc `.claude/settings.json` khi có `--shared`. Mọi khoá và hook khác có sẵn SHALL được giữ nguyên.

#### Scenario: Cài mặc định
- **WHEN** chạy `nightowl init` trong repo chưa có thư mục `.claude/`
- **THEN** `.claude/settings.local.json` được tạo, là JSON hợp lệ, chứa hai hook trên, và `.claude/settings.json` không được tạo

#### Scenario: Chưa có settings.json
- **WHEN** chạy `nightowl init --shared` trong repo chưa có thư mục `.claude/`
- **THEN** `.claude/settings.json` được tạo và chứa hai hook trên, và `.claude/settings.local.json` không được tạo

#### Scenario: Gộp với cấu hình có sẵn
- **WHEN** `.claude/settings.local.json` đã có `permissions` và một hook `PostToolUse` khác, rồi chạy `nightowl init`
- **THEN** `permissions` và hook cũ còn nguyên, hai hook của NightOwl được thêm vào

#### Scenario: settings.json hỏng
- **WHEN** `.claude/settings.json` không phải JSON hợp lệ và chạy `nightowl init --shared`
- **THEN** lệnh không sửa file, stderr nêu đường dẫn file và lỗi, mã thoát 1

#### Scenario: settings.local.json hỏng
- **WHEN** `.claude/settings.local.json` không phải JSON hợp lệ và chạy `nightowl init`
- **THEN** lệnh không sửa file, stderr nêu đường dẫn file và lỗi, mã thoát 1

### Requirement: init chạy lại được
Chạy `nightowl init` (với cùng tuỳ chọn) nhiều lần SHALL cho cùng kết quả như chạy một lần: không trùng hook, không trùng dòng `.gitignore`.

#### Scenario: Chạy hai lần
- **WHEN** chạy `nightowl init` hai lần liên tiếp
- **THEN** sau lần thứ hai, `.gitignore` và `.claude/settings.local.json` giống hệt sau lần thứ nhất

## ADDED Requirements

### Requirement: File settings cá nhân không vào git
Trước khi ghi `.claude/settings.local.json`, `nightowl init` SHALL đảm bảo git bỏ qua file đó: nếu chưa bị bỏ qua thì thêm `.claude/settings.local.json` vào `.gitignore`. Nếu file đã được git theo dõi, `init` SHALL NOT ghi vào nó, SHALL in lỗi gợi ý `--shared` ra stderr, và thoát mã 1.

#### Scenario: Chưa có quy tắc bỏ qua
- **WHEN** chạy `nightowl init` trong repo không bỏ qua `.claude/settings.local.json`
- **THEN** `.gitignore` có dòng `.claude/settings.local.json` và `git status` không liệt kê file đó

#### Scenario: Đã bị bỏ qua sẵn
- **WHEN** `.git/info/exclude` đã có `.claude/settings.local.json`, rồi chạy `nightowl init`
- **THEN** `.gitignore` không có dòng `.claude/settings.local.json`

#### Scenario: File cá nhân đã được commit
- **WHEN** `.claude/settings.local.json` đã được commit vào repo, rồi chạy `nightowl init`
- **THEN** file không đổi, stderr có gợi ý `--shared`, mã thoát 1

### Requirement: Hook Claude Code chỉ ở một file
NightOwl SHALL NOT có hook ở cả `.claude/settings.json` lẫn `.claude/settings.local.json` do `init` gây ra. Khi hook NightOwl đã có ở file không phải file đích, `init` SHALL NOT thêm hook vào file đích, và SHALL in ra stdout file đang chứa hook cùng lệnh để chuyển (`nightowl uninstall`, rồi `nightowl init`). Khi hook có ở cả hai file, `init` SHALL in cảnh báo ra stderr rằng sự kiện bị ghi hai lần.

#### Scenario: Repo đã cài kiểu cũ
- **WHEN** `.claude/settings.json` đã có hook NightOwl và chạy `nightowl init` (không có `--shared`)
- **THEN** `.claude/settings.local.json` không có hook NightOwl, stdout nêu `.claude/settings.json` và `nightowl uninstall`, mã thoát 0

### Requirement: Hook Claude Code chịu được máy chưa cài
Lệnh trong hook Claude Code SHALL thoát mã 0 và không in gì khi `nightowl` không có trong `PATH`. `nightowl init` SHALL thay hook NightOwl dạng cũ (`nightowl log`) bằng dạng mới ngay tại chỗ, ở bất kỳ file settings nào, giữ nguyên `matcher`, `timeout` và vị trí.

#### Scenario: Đồng đội chưa cài nightowl
- **WHEN** lệnh hook được chạy bằng `sh -c` với `PATH` không chứa `nightowl`
- **THEN** mã thoát là 0 và stdout, stderr đều rỗng

#### Scenario: Nâng cấp hook dạng cũ
- **WHEN** `.claude/settings.json` có hook `nightowl log` dạng cũ và chạy `nightowl init`
- **THEN** hook đó chạy lệnh dạng mới, vẫn đúng event và matcher cũ, và không có hook NightOwl thứ hai

### Requirement: Gỡ NightOwl
`nightowl uninstall` SHALL gỡ mọi hook NightOwl (dạng cũ và mới) khỏi `.claude/settings.json` và `.claude/settings.local.json`, và gỡ dòng NightOwl khỏi hook `pre-commit` và `post-commit`. Mọi cấu hình và hook khác SHALL được giữ nguyên. File chỉ còn phần NightOwl đã tạo SHALL bị xoá. Lệnh SHALL in ra stdout danh sách file đã sửa hoặc xoá, hoặc báo không có gì để gỡ, rồi thoát mã 0.

#### Scenario: Gỡ sau khi cài mặc định
- **WHEN** chạy `nightowl init` rồi `nightowl uninstall` trong một repo mới
- **THEN** `.claude/settings.local.json`, `.git/hooks/pre-commit` và `.git/hooks/post-commit` không còn tồn tại, mã thoát 0

#### Scenario: Giữ cấu hình của người dùng
- **WHEN** `.claude/settings.json` có `permissions`, một hook `PostToolUse` khác và hook NightOwl, và `pre-commit` chạy `npm run lint` cùng dòng NightOwl, rồi chạy `nightowl uninstall`
- **THEN** `permissions`, hook khác và dòng `npm run lint` còn nguyên, không còn gì của NightOwl

#### Scenario: Chạy khi chưa cài
- **WHEN** chạy `nightowl uninstall` trong repo chưa từng cài NightOwl
- **THEN** stdout báo không có gì để gỡ, không file nào bị tạo hay sửa, mã thoát 0

### Requirement: uninstall giữ dữ liệu
`nightowl uninstall` SHALL NOT xoá hay sửa `.nightowl/` và `.gitignore`, và SHALL in ra stdout rằng dữ liệu vẫn nằm trong `.nightowl/`.

#### Scenario: Dữ liệu còn sau khi gỡ
- **WHEN** repo có `.nightowl/nightowl.db` và chạy `nightowl uninstall`
- **THEN** `.nightowl/nightowl.db` và `.gitignore` không đổi, stdout nhắc tới `.nightowl/`

### Requirement: uninstall không sửa hook do công cụ khác quản lý
Khi repo đặt `core.hooksPath`, hoặc hook là symlink, `nightowl uninstall` SHALL NOT sửa file hook đó, và SHALL in ra stderr dòng NightOwl cần tự xoá, rồi vẫn thoát mã 0.

#### Scenario: Repo dùng husky
- **WHEN** `core.hooksPath` là `.husky` và chạy `nightowl uninstall`
- **THEN** không file nào trong `.husky/` bị sửa và stderr nêu dòng gọi `nightowl precommit` cần tự xoá
