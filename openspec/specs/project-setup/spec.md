# project-setup Specification

## Purpose
Lệnh `nightowl init` chuẩn bị một dự án để NightOwl tự ghi dữ liệu: bỏ dữ liệu khỏi git và đăng ký hook, an toàn khi chạy lại và không phá cấu hình người dùng đã có.

## Requirements

### Requirement: init chỉ chạy trong repo git
`nightowl init` SHALL chạy ở gốc của repo git chứa thư mục làm việc. Khi không có repo git, lệnh SHALL báo lỗi ra stderr, không tạo file nào, và thoát mã 1.

#### Scenario: Ngoài repo git
- **WHEN** chạy `nightowl init` ở thư mục không thuộc repo git
- **THEN** stderr báo không tìm thấy repo git, không file nào được tạo, mã thoát 1

#### Scenario: Chạy từ thư mục con
- **WHEN** chạy `nightowl init` trong `<repo>/src`
- **THEN** mọi file được tạo hoặc sửa nằm ở `<repo>`, không phải `<repo>/src`

### Requirement: Bỏ dữ liệu NightOwl khỏi git
`nightowl init` SHALL đảm bảo `.gitignore` ở gốc repo có dòng `.nightowl/`, tạo file nếu chưa có, giữ nguyên mọi dòng khác, và không thêm trùng.

#### Scenario: Chưa có .gitignore
- **WHEN** chạy `nightowl init` trong repo chưa có `.gitignore`
- **THEN** `.gitignore` được tạo và chứa dòng `.nightowl/`

#### Scenario: Đã có dòng
- **WHEN** `.gitignore` đã có `.nightowl/` và chạy `nightowl init`
- **THEN** `.gitignore` không đổi

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

### Requirement: Báo kết quả
`nightowl init` SHALL in ra stdout danh sách file đã tạo hoặc sửa (hoặc báo đã cài sẵn) và thoát mã 0. Khi lệnh `nightowl` không có trong `PATH`, SHALL in thêm cảnh báo ra stderr rằng hook sẽ không chạy được.

#### Scenario: nightowl không có trong PATH
- **WHEN** chạy `nightowl init` qua `npx` trên máy chưa cài `nightowl` toàn cục
- **THEN** cài đặt vẫn hoàn tất, mã thoát 0, stderr có cảnh báo kèm cách cài (`npm i -g @hoanghainh/nightowl-evals`)

### Requirement: Cài git hook pre-commit
`nightowl init` SHALL đảm bảo hook `pre-commit` của repo gọi `nightowl precommit` theo cách không bao giờ làm commit thất bại. Hook chưa có SHALL được tạo mới và cho phép thực thi. Hook shell có sẵn SHALL được giữ nguyên nội dung, chỉ thêm dòng gọi NightOwl ngay sau dòng shebang. Chạy lại `init` SHALL không thêm trùng.

#### Scenario: Chưa có hook
- **WHEN** chạy `nightowl init` trong repo chưa có `.git/hooks/pre-commit`
- **THEN** file được tạo, có quyền thực thi, và gọi `nightowl precommit`

#### Scenario: Đã có hook shell khác
- **WHEN** `.git/hooks/pre-commit` là script `sh` chạy `npm run lint`, rồi chạy `nightowl init`
- **THEN** hook vẫn chạy `npm run lint` như cũ và có thêm dòng gọi `nightowl precommit`

#### Scenario: Chạy init hai lần
- **WHEN** chạy `nightowl init` hai lần
- **THEN** hook chỉ có một dòng gọi `nightowl precommit`

#### Scenario: nightowl bị gỡ khỏi máy
- **WHEN** hook đã cài nhưng lệnh `nightowl` không còn trong `PATH`, và dev chạy `git commit`
- **THEN** commit thành công như không có NightOwl

### Requirement: Không sửa hook do công cụ khác quản lý
Khi repo đặt `core.hooksPath`, hoặc hook `pre-commit` có sẵn không phải script shell, `nightowl init` SHALL NOT sửa file hook nào, và SHALL in ra stderr dòng lệnh cần tự thêm vào hook `pre-commit`, rồi thoát mã 0.

#### Scenario: Repo dùng husky
- **WHEN** `core.hooksPath` là `.husky` và chạy `nightowl init`
- **THEN** không file nào trong `.husky/` bị sửa, stderr có hướng dẫn thêm dòng gọi `nightowl precommit`, mã thoát 0

#### Scenario: Hook viết bằng Node
- **WHEN** `.git/hooks/pre-commit` bắt đầu bằng `#!/usr/bin/env node`
- **THEN** file không bị sửa và stderr có hướng dẫn thêm dòng gọi

### Requirement: Cài git hook post-commit
`nightowl init` SHALL đảm bảo hook `post-commit` của repo gọi `nightowl postcommit`, theo đúng các quy tắc an toàn của hook `pre-commit`: tạo mới khi chưa có, chèn sau shebang của hook shell có sẵn, không sửa hook do `core.hooksPath` quản lý, hook không phải shell hoặc hook là symlink (khi đó in hướng dẫn), không thêm trùng khi chạy lại, và không bao giờ làm git lỗi.

#### Scenario: Chạy init trên repo đã cài từ tuần 1
- **WHEN** repo đã có hook `pre-commit` của NightOwl và chạy `nightowl init`
- **THEN** hook `pre-commit` không đổi và hook `post-commit` gọi `nightowl postcommit` được tạo

#### Scenario: nightowl bị gỡ khỏi máy
- **WHEN** hook `post-commit` đã cài nhưng lệnh `nightowl` không còn trong `PATH`, và dev commit
- **THEN** commit thành công và không có thông báo lỗi nào

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

### Requirement: Chẩn đoán môi trường và cấu hình
`nightowl doctor` SHALL kiểm tra Node.js (>= 22.13.0, `node:sqlite`), Git repo, cấu hình hook Claude Code, Git hooks (`pre-commit`, `post-commit`), cùng thư mục `.nightowl/` và database SQLite. Lệnh SHALL in kết quả chẩn đoán ra stdout. Khi gặp lỗi nghiêm trọng (Node không hợp lệ, ngoài Git repo, database hỏng), lệnh SHALL thoát mã 1. Khi môi trường sẵn sàng hoặc chỉ có cảnh báo, lệnh SHALL thoát mã 0.

#### Scenario: Chẩn đoán trên dự án đầy đủ hợp lệ
- **WHEN** chạy `nightowl doctor` trong repo đã cài đặt đầy đủ hook, Node >= 22.13 và SQLite toàn vẹn
- **THEN** stdout hiển thị trạng thái hợp lệ cho toàn bộ 5 nhóm kiểm tra và lệnh thoát mã 0

#### Scenario: Chẩn đoán trong dự án chưa khởi tạo
- **WHEN** chạy `nightowl doctor` trong repo git chưa chạy `nightowl init`
- **THEN** stdout cảnh báo các hook chưa được cài đặt và gợi ý chạy `nightowl init`, lệnh thoát mã 0

#### Scenario: Chẩn đoán khi Node.js không tương thích
- **WHEN** chạy `nightowl doctor` trên phiên bản Node.js thấp hơn 22.13.0
- **THEN** stdout/stderr báo lỗi Node.js không tương thích và lệnh thoát mã 1

#### Scenario: Chẩn đoán khi ngoài Git repo
- **WHEN** chạy `nightowl doctor` tại thư mục không thuộc git repository
- **THEN** lệnh báo lỗi không tìm thấy git repository và thoát mã 1

#### Scenario: Chẩn đoán khi database bị hỏng
- **WHEN** file `.nightowl/nightowl.db` bị hỏng hoặc không vượt qua kiểm tra toàn vẹn
- **THEN** lệnh báo lỗi kiểm tra database thất bại và thoát mã 1

#### Scenario: Cờ --strict khi có cảnh báo
- **WHEN** chạy `nightowl doctor --strict` và có ít nhất một cảnh báo (ví dụ chưa cài hook)
- **THEN** lệnh thoát mã 1
