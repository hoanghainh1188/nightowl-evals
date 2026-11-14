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
Khi repo đặt `core.hooksPath`, sử dụng công cụ quản lý hook (như Husky hoặc Lefthook), hoặc hook có sẵn không phải shell, `nightowl init` SHALL NOT sửa file hook nào. Thay vào đó, lệnh SHALL in ra stderr thông tin nhận diện công cụ kèm snippet cấu hình phù hợp rồi thoát mã 0.

#### Scenario: Repo dùng husky
- **WHEN** repo có thư mục `.husky` hoặc `core.hooksPath` đặt tới `.husky` và chạy `nightowl init`
- **THEN** không file nào trong `.husky/` bị sửa, stderr có hướng dẫn thêm dòng gọi `nightowl precommit` cho Husky, mã thoát 0

#### Scenario: Repo dùng lefthook
- **WHEN** repo có file `lefthook.yml` hoặc `lefthook.yaml` và chạy `nightowl init`
- **THEN** file cấu hình không bị ghi đè, stderr in snippet cấu hình YAML mẫu cho Lefthook, mã thoát 0

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
`nightowl doctor` SHALL kiểm tra Node.js (>= 22.13.0, `node:sqlite`), Git repo, cấu hình hook Claude Code, cấu hình ingest đa agent theo maturity (Cursor và các agent verified/best-effort đã document), Git hooks (`pre-commit`, `post-commit` hoặc hook manager), cùng `.nightowl/` và database SQLite. Lệnh SHALL in kết quả ra stdout. Khi gặp lỗi nghiêm trọng (Node không hợp lệ, ngoài Git repo, database hỏng), lệnh SHALL thoát mã 1. Khi môi trường sẵn sàng hoặc chỉ có cảnh báo, lệnh SHALL thoát mã 0.

#### Scenario: Chẩn đoán trên dự án đầy đủ hợp lệ
- **WHEN** chạy `nightowl doctor` trong repo đã cài đặt đầy đủ hook, Node >= 22.13 và SQLite toàn vẹn
- **THEN** stdout hiển thị trạng thái hợp lệ cho các nhóm kiểm tra (gồm Claude và agent verified đã cài) và lệnh thoát mã 0

#### Scenario: Chẩn đoán khi dùng hook manager
- **WHEN** chạy `nightowl doctor` trong repo dùng Husky hoặc Lefthook đã cấu hình gọi NightOwl
- **THEN** nhóm kiểm tra Git hooks nhận diện đúng hook manager tương ứng và báo cáo hợp lệ

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

### Requirement: Doctor cảnh báo thiếu dữ liệu cho report
Khi `.nightowl/nightowl.db` tồn tại và toàn vẹn nhưng chưa có failure đã ghi (tổng failure = 0), `nightowl doctor` SHALL báo **cảnh báo** (không fail) rằng dữ liệu chưa đủ để `report` hữu ích, kèm gợi ý ghi failure (hooks/`init`) trước khi dùng CI gate. `--strict` SHALL coi cảnh báo này như các warn khác (thoát mã 1).

#### Scenario: DB có nhưng chưa có failure
- **WHEN** chạy `nightowl doctor` với database hợp lệ và 0 failure
- **THEN** stdout có cảnh báo thiếu dữ liệu cho report và mã thoát 0 (không `--strict`)

#### Scenario: --strict với DB trống failure
- **WHEN** chạy `nightowl doctor --strict` với database hợp lệ và 0 failure
- **THEN** lệnh thoát mã 1 vì có cảnh báo sẵn sàng report

#### Scenario: Đã có failure thì không cảnh báo thiếu dữ liệu
- **WHEN** database có ≥1 failure và chạy `nightowl doctor`
- **THEN** không có cảnh báo “thiếu dữ liệu cho report” vì lý do 0 failure

### Requirement: Doctor báo rõ hook đa agent theo maturity
`nightowl doctor` SHALL tiếp tục kiểm tra cấu hình ingest đa agent (Claude, Cursor verified, agent best-effort/manual đã document) và SHALL nêu rõ từng agent/maturity trên stdout (ok hoặc warn khi thiếu marker/file). Thiếu hook agent SHALL là cảnh báo, không phải lỗi nghiêm trọng, trừ khi `--strict`.

#### Scenario: Thiếu Cursor hooks
- **WHEN** repo chưa có NightOwl Cursor hooks và chạy `nightowl doctor`
- **THEN** stdout cảnh báo Cursor/agent tương ứng kèm gợi ý `nightowl init --agents …`, thoát 0

#### Scenario: Agent verified đã cài
- **WHEN** Cursor (hoặc agent verified) đã có marker NightOwl hợp lệ
- **THEN** stdout đánh dấu nhóm agent đó hợp lệ (ok)

### Requirement: init đăng ký hook đa agent
`nightowl init` SHALL cài cấu hình ingest cho Claude Code (như hiện tại) và cho các agent hỗ trợ có thể cấu hình trên máy (ít nhất Cursor qua `.cursor/hooks.json` personal hoặc shared tương đương). Cài đặt SHALL idempotent, không xoá hook của người dùng khác.

#### Scenario: init thêm Cursor hooks
- **WHEN** chạy `nightowl init` trong repo chưa có NightOwl Cursor hooks
- **THEN** `.cursor/hooks.json` (hoặc file đích đã document) chứa lệnh gọi `nightowl log` cho prompt/edit; exit 0

#### Scenario: chạy lại init
- **WHEN** chạy `nightowl init` lần hai
- **THEN** không nhân đôi hook NightOwl

### Requirement: uninstall gỡ hook đa agent
`nightowl uninstall` SHALL gỡ hook NightOwl đã cài cho mọi agent nó quản lý, giữ nguyên hook không phải NightOwl.

#### Scenario: uninstall Cursor
- **WHEN** đã init Cursor hooks rồi chạy `nightowl uninstall`
- **THEN** lệnh NightOwl biến mất khỏi cấu hình Cursor; hook khác còn lại

### Requirement: Tuỳ chọn chọn agent khi init
`nightowl init` SHALL chấp nhận `--agents <list>` (hoặc tương đương) để chọn subset; mặc định cài mọi agent hỗ trợ có thể ghi cấu hình. Agent không áp dụng được trên OS/môi trường SHALL bị bỏ qua kèm cảnh báo, không fail cả lệnh.

#### Scenario: chỉ Cursor
- **WHEN** `nightowl init --agents cursor`
- **THEN** cài Cursor + git hooks; không bắt buộc đụng Windsurf/Cline nếu không chọn

### Requirement: init tôn trọng maturity khi cài agent
Khi cài agent có maturity `verified` hoặc `best-effort` với đường cấu hình đã biết, `nightowl init` SHALL ghi đúng định dạng file/tool đã document (idempotent). Khi maturity là `manual`, init SHALL NOT ghi file giả “hook native” như thể tool sẽ đọc; SHALL in hướng dẫn cấu hình thủ công.

#### Scenario: init verified Cursor không đổi hành vi
- **WHEN** `nightowl init --agents cursor`
- **THEN** `.cursor/hooks.json` vẫn nhận NightOwl hooks như hiện tại

#### Scenario: init manual không tạo hook giả
- **WHEN** `nightowl init --agents` gồm một agent `manual`
- **THEN** không tạo file cấu hình tuyên bố sai là hook native của tool đó; có cảnh báo/hướng dẫn

### Requirement: doctor kiểm tra hook đa agent
`nightowl doctor` SHALL kiểm tra sự hiện diện cấu hình NightOwl cho các agent `verified`/`best-effort` đã document (ít nhất Cursor ngoài Claude Code). Thiếu cấu hình SHALL là cảnh báo (exit 0 trừ `--strict`). Agent `manual` SHALL được liệt kê là cần cấu hình thủ công, không fail như thiếu hook native.

#### Scenario: thiếu Cursor hooks
- **WHEN** repo đã init git/Claude nhưng thiếu NightOwl trong `.cursor/hooks.json` và chạy `nightowl doctor`
- **THEN** có cảnh báo Cursor/agent hooks; exit 0 (hoặc 1 với `--strict`)

#### Scenario: agent manual trong doctor
- **WHEN** chạy `doctor` và registry có agent `manual`
- **THEN** output nêu agent đó cần setup thủ công, không báo “hook file missing” như verified

### Requirement: Doctor kiểm tra workspace monorepo
Khi repo có cấu hình workspace đã hỗ trợ (`package.json` `workspaces` và/hoặc `pnpm-workspace.yaml`), `nightowl doctor` SHALL chạy discovery local (không gọi mạng) và SHALL báo **cảnh báo** nếu discovery trả về tập rỗng (config có nhưng không resolve được package). Khi discovery tìm thấy ≥1 package, SHALL báo ok kèm số package (hoặc tương đương đã document). Khi không có cấu hình workspace, SHALL NOT thêm cảnh báo workspace giả. `--strict` SHALL coi cảnh báo workspace như các warn khác.

#### Scenario: Config workspace nhưng discovery rỗng
- **WHEN** repo có `package.json` `workspaces: ["packages/*"]` (hoặc `pnpm-workspace.yaml`) nhưng không có package dir khớp, chạy `nightowl doctor`
- **THEN** stdout có cảnh báo workspace discovery rỗng; thoát 0 (không `--strict`)

#### Scenario: Monorepo có package
- **WHEN** discovery tìm thấy ≥1 package root và chạy `nightowl doctor`
- **THEN** stdout có dòng ok về workspace/packages; thoát 0 nếu không lỗi khác

#### Scenario: Không phải monorepo
- **WHEN** repo không có cấu hình workspace đã hỗ trợ và chạy `nightowl doctor`
- **THEN** không có cảnh báo “workspace discovery” vì thiếu config

### Requirement: Doctor xác minh hook/agent authenticity
Ngoài kiểm tra tồn tại file cấu hình, `nightowl doctor` SHALL xác minh cấu trúc tối thiểu mà tool/hook manager đọc được trên máy: file JSON agent (khi dùng) parse được và chứa entry NightOwl đã document; git hook (hoặc hook manager) gọi đúng lệnh NightOwl tương ứng; khi hook file tồn tại trên POSIX, SHALL cảnh báo nếu không executable (Windows: bỏ qua hoặc document no-op quyền execute). Thiếu authenticity SHALL là cảnh báo, không fail nghiêm trọng, trừ `--strict`.

#### Scenario: Cursor JSON hỏng
- **WHEN** `.cursor/hooks.json` tồn tại nhưng không phải JSON hợp lệ và chạy `nightowl doctor`
- **THEN** cảnh báo authenticity/parse Cursor; thoát 0 (không `--strict`)

#### Scenario: Git hook thiếu execute bit trên POSIX
- **WHEN** trên môi trường POSIX, hook `.git/hooks/pre-commit` gọi NightOwl nhưng không executable, chạy `nightowl doctor`
- **THEN** stdout cảnh báo quyền thực thi hook; thoát 0 (không `--strict`)

### Requirement: Doctor tóm tắt sẵn sàng report cho team
Khi database tồn tại và toàn vẹn, `nightowl doctor` SHALL in tóm tắt readiness gồm: số failure không dismissed (reportable), và đếm signals đã document (`ci-fail`, `pr-review`, `revert`) trên toàn store hoặc cửa sổ mặc định đã document — không lộ tên/email developer. Cảnh báo “thiếu dữ liệu cho report” hiện có (0 reportable failure) SHALL được giữ. Khi có reportable failure nhưng 0 signal, SHALL NOT fail; MAY ghi nhận signals = 0 trong tóm tắt (ok hoặc info trong cùng dòng thống kê).

#### Scenario: Có failure và signals
- **WHEN** DB có ≥1 failure không dismissed và ≥1 sự kiện signal, chạy `nightowl doctor`
- **THEN** stdout nêu số failure reportable và đếm signals > 0 (hoặc từng kind); không cảnh báo “No failures recorded yet”

#### Scenario: Có failure nhưng chưa có signal
- **WHEN** DB có ≥1 failure reportable và 0 signal events, chạy `nightowl doctor`
- **THEN** tóm tắt readiness phản ánh signals 0; thoát 0 nếu không warn/fail khác bắt buộc

### Requirement: Cài git hook trên Windows không phụ thuộc execute-bit
Khi `nightowl init` cài hoặc cập nhật git hook NightOwl trên `win32`, lệnh SHALL ghi nội dung hook gọi lệnh NightOwl tương ứng và SHALL NOT fail chỉ vì không đặt được quyền execute POSIX (`chmod`/`X_OK`). Trên POSIX, hành vi tạo hook executable (khi tạo mới) SHALL được giữ. `nightowl doctor` trên Windows SHALL tiếp tục bỏ qua cảnh báo execute-bit (đã document).

#### Scenario: Init hook trên win32
- **WHEN** chạy `nightowl init` trên môi trường `win32` (hoặc stub platform) trong repo git chưa có hook NightOwl
- **THEN** file hook chứa lệnh NightOwl; thoát 0 dù execute-bit không áp dụng như POSIX

#### Scenario: Doctor win32 không warn execute-bit
- **WHEN** trên `win32`, hook NightOwl tồn tại nhưng không “executable” theo nghĩa POSIX, chạy `nightowl doctor`
- **THEN** không cảnh báo thiếu execute-bit cho hook đó

### Requirement: Doctor kiểm tra shape cấu hình best-effort
Ngoài tồn tại file/marker, `nightowl doctor` SHALL kiểm tra shape tối thiểu đã document cho mỗi agent `best-effort` có đường cấu hình (ít nhất Windsurf hooks events NightOwl; Cline/Roo marker có `nightowl` + `command` gọi NightOwl). File parse được nhưng thiếu entry/event bắt buộc SHALL cảnh báo authenticity/shape (không fail nghiêm trọng trừ `--strict`). Agent `manual` SHALL NOT bị báo “missing native hook file”.

#### Scenario: Windsurf thiếu event hook NightOwl
- **WHEN** `.windsurf/hooks.json` tồn tại JSON hợp lệ nhưng thiếu entry NightOwl trên event đã document, chạy `nightowl doctor`
- **THEN** stdout cảnh báo shape/authenticity Windsurf; thoát 0 (không `--strict`)

#### Scenario: Cline marker thiếu command NightOwl
- **WHEN** `.cline/nightowl.json` tồn tại nhưng không có command/marker NightOwl hợp lệ, chạy `nightowl doctor`
- **THEN** cảnh báo shape Cline; thoát 0 (không `--strict`)

### Requirement: init ghi cấu hình best-effort đúng contract sâu hơn
Khi `nightowl init` cài agent `best-effort` có đường cấu hình, lệnh SHALL ghi đúng contract đã document (Windsurf: events hook + lệnh NightOwl; Cline/Roo: marker `nightowl` + command + agent id) và idempotent. SHALL NOT ghi file trống hoặc marker không đủ field tối thiểu đã document.

#### Scenario: init Windsurf tạo đủ event
- **WHEN** `nightowl init --agents windsurf` trong repo chưa có NightOwl Windsurf hooks
- **THEN** `.windsurf/hooks.json` có entry NightOwl trên các event đã document; exit 0

#### Scenario: init Cline marker đủ field
- **WHEN** `nightowl init --agents cline` (maturity best-effort)
- **THEN** `.cline/nightowl.json` chứa marker `nightowl` và command gọi `nightowl log`; exit 0

### Requirement: Doctor đo thời gian query report mẫu
`nightowl doctor` SHALL đo thời gian (ms) của ít nhất một thao tác đọc kiểu report trên store local (ví dụ đếm failures trong cửa sổ gần) và báo kết quả. Khi vượt ngân sách đã document, SHALL cảnh báo (warn). SHALL NOT gọi mạng.

#### Scenario: Doctor báo timing ok
- **WHEN** chạy `nightowl doctor` trên DB nhỏ/nhanh
- **THEN** stdout có dòng timing/query budget (ok) hoặc tương đương đã document

#### Scenario: Doctor cảnh báo khi chậm
- **WHEN** đo vượt ngưỡng budget đã document (hoặc fixture mô phỏng)
- **THEN** doctor đánh dấu warn cho kiểm tra timing và vẫn thoát 0 trừ khi `--strict` và design bắt fail

### Requirement: doctor kiểm tra local config
`nightowl doctor` SHALL kiểm tra project config và local overlay (nếu tồn tại): thiếu cả hai là OK (pass/info); file tồn tại nhưng invalid SHALL báo fail với path + lý do; file hợp lệ SHALL pass. Doctor SHALL NOT gọi mạng; SHALL NOT sửa file config trừ khi người dùng chạy lệnh khác đã document.

#### Scenario: Config hợp lệ
- **WHEN** có `nightowl.config.json` hợp lệ v1 và chạy `nightowl doctor`
- **THEN** kết quả có mục config pass (hoặc tương đương)

#### Scenario: Config invalid
- **WHEN** project config JSON hỏng hoặc schema fail và chạy `nightowl doctor`
- **THEN** mục config fail với stderr/stdout nêu lỗi; mã thoát doctor ≠ 0 theo quy tắc doctor hiện có khi có fail

### Requirement: init tạo mẫu project config khi thiếu
`nightowl init` SHALL tạo file project config mẫu an toàn (chỉ `version` và/hoặc defaults trống đã document) khi file chưa tồn tại, và SHALL NOT ghi đè file đã có. Mẫu SHALL NOT chứa secret. Init vẫn thêm `.nightowl/` vào `.gitignore` như hiện tại (local overlay nằm dưới đó).

#### Scenario: Init lần đầu không có config
- **WHEN** chạy `nightowl init` trong repo chưa có project config
- **THEN** file project config được tạo với schema v1 tối thiểu; mã thoát 0

#### Scenario: Init không ghi đè
- **WHEN** project config đã tồn tại và chạy `nightowl init` lại
- **THEN** nội dung file config không bị thay bởi mẫu mặc định
