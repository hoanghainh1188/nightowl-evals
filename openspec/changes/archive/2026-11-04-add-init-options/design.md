# Design

## Context

Xem proposal.md. Hành vi: `specs/project-setup`, `specs/cli`.

Hiện tại:
- `src/setup/claude-settings.ts` gộp hai hook (`PostToolUse` matcher `Edit|Write|MultiEdit`, `UserPromptSubmit`) vào `.claude/settings.json`. Nó nhận diện hook NightOwl bằng `command === 'nightowl log'`.
- `src/setup/git-hook.ts` chèn một dòng có đuôi `# nightowl-evals` sau shebang của `pre-commit` và `post-commit`. Hook do NightOwl tạo có đúng nội dung `#!/bin/sh\n<dòng>\n`.

Claude Code đọc hook từ mọi file settings của dự án (`settings.json`, `settings.local.json`) và chạy tất cả. Hook có ở cả hai file thì mỗi sự kiện chạy hai lần.

## Goals / Non-Goals

**Goals:**
- Cài cho một người mà không làm phiền người khác dùng chung repo.
- Gỡ sạch những gì NightOwl đã thêm, không đụng phần của người dùng.
- Repo đã cài từ trước vẫn chạy y như cũ sau khi cập nhật NightOwl.

**Non-Goals:**
- File cấu hình riêng của NightOwl.
- Tự động chuyển hook từ file chung sang file cá nhân.

## Decisions

### 1. Mặc định là file cá nhân
`settings.local.json` là chỗ Claude Code dành cho cấu hình riêng của từng người. Người dùng NightOwl đầu tiên (giai đoạn 1, 2) là từng dev riêng lẻ, nên mặc định cá nhân an toàn hơn. Team muốn dùng chung thì chọn `--shared` một cách có chủ đích.

### 2. Đảm bảo file cá nhân bị git bỏ qua
Claude Code chỉ tự cấu hình git bỏ qua `settings.local.json` khi chính nó tạo file. NightOwl tạo file thì phải tự lo:
- chạy `git check-ignore -q .claude/settings.local.json`;
- mã thoát 0 (đã bị bỏ qua, qua `.gitignore`, `.git/info/exclude` hay cấu hình global) thì không làm gì;
- mã thoát 1 thì thêm `.claude/settings.local.json` vào `.gitignore` bằng hàm `addGitignoreEntry` đã có;
- lỗi khác của git thì báo lỗi, không ghi gì.

Bước kiểm tra chạy trước khi ghi `settings.local.json`, để file không bao giờ tồn tại mà chưa bị bỏ qua.

Nếu `settings.local.json` đã bị git theo dõi (`git ls-files` có tên file), `init` không ghi vào đó. Nó báo lỗi và gợi ý `--shared`, vì ghi vào thì hook sẽ đi vào commit dù người dùng không muốn.

### 3. Một chỗ duy nhất
Trước khi ghi, `init` đọc cả hai file. Nhận diện hook NightOwl theo lệnh: `nightowl log` (dạng cũ) hoặc dòng có kiểm tra (dạng mới).
- Có hook ở file đích: nâng cấp dạng cũ thành dạng mới nếu cần, thêm hook còn thiếu.
- Có hook ở file còn lại, không có ở file đích: không ghi file đích. Vẫn nâng cấp dạng cũ ở file còn lại, vì đó là sửa lỗi an toàn. Báo ra stdout, ví dụ: `Claude Code hooks are in .claude/settings.json (shared). To make them personal: nightowl uninstall && nightowl init`.
- Có ở cả hai (do người dùng tự thêm): không thêm gì, in cảnh báo ra stderr rằng sự kiện bị ghi hai lần.

### 4. Lệnh hook có kiểm tra
```
command -v nightowl >/dev/null 2>&1 && nightowl log || true
```
Cùng cách viết với git hook đã có. Không đổi `>/dev/null` đầu ra của `nightowl log`, vì lệnh này vốn không in gì. Hook PostToolUse được Claude Code chạy qua shell, nên `command -v` dùng được. Windows không nằm trong phạm vi (git hook cũng là `sh`).

Dạng cũ trong file được thay tại chỗ: giữ nguyên `matcher`, `timeout` và vị trí trong danh sách, chỉ đổi `command`.

### 5. `nightowl uninstall` là lệnh riêng
Không dùng `init --uninstall`, vì một tuỳ chọn đảo ngược hoàn toàn tác dụng của lệnh dễ gây nhầm, nhất là khi gõ sai. Lệnh không nhận tuỳ chọn nào (dùng `acceptsNoArguments`).

Gỡ hook trong settings (hàm thuần `removeClaudeHooks(settings)`):
- bỏ mọi hook NightOwl (cả hai dạng) trong mọi event;
- bỏ nhóm (`{ matcher, hooks }`) chỉ khi danh sách `hooks` của nó thành rỗng;
- bỏ khoá event khi danh sách thành rỗng, bỏ `hooks` khi object thành rỗng;
- file chỉ còn `{}` thì xoá file; còn nội dung khác thì ghi lại (atomic).

Gỡ git hook (hàm thuần `removeHookLine(content)`):
- bỏ các dòng kết thúc bằng `# nightowl-evals`;
- phần còn lại chỉ là shebang (đúng thứ NightOwl đã tạo) thì xoá file;
- còn nội dung khác thì ghi lại, giữ quyền thực thi.

`core.hooksPath` hoặc hook là symlink: không sửa, in ra stderr dòng cần tự xoá (giống cách `init` in dòng cần tự thêm).

Không xoá `.nightowl/` và không sửa `.gitignore`: dữ liệu lỗi là thứ người dùng đã tích luỹ, xoá nhầm thì không lấy lại được. Lệnh in `Your data is kept in .nightowl/. Delete it yourself if you no longer need it.`

### 6. Tuỳ chọn `--shared` và spec `cli`
`init` chuyển từ `acceptsNoArguments` sang `parseArgs` với một tuỳ chọn boolean `shared`, `strict: true`. Trợ giúp của `init` liệt kê `--shared`. Spec `cli` hiện ghi `init` không nhận tuỳ chọn nào, nên requirement đó được sửa.

## Risks / Trade-offs

- [Người dùng cũ chạy `init` lại và tưởng hook đã chuyển sang file cá nhân] → `init` in rõ hook đang ở file nào và lệnh để chuyển.
- [Dạng cũ `nightowl log` còn trong file mà người dùng không chạy lại `init`] → Vẫn chạy như trước; chỉ máy chưa cài mới bị báo lỗi. `uninstall` nhận diện được cả dạng cũ.
- [Người dùng tự viết hook có lệnh trùng chuỗi `nightowl log`] → Bị coi là của NightOwl. Chấp nhận được: đó chính là hook của NightOwl.
