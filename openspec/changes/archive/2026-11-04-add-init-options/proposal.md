# Proposal

## Why

`nightowl init` hiện không cấu hình được gì: lúc nào cũng ghi hook Claude Code vào `.claude/settings.json`. File này thường được commit chung cho cả team. Có hai hậu quả:

- Bạn commit file đó thì máy đồng đội chưa cài `nightowl` gặp lỗi "command not found" sau mỗi lần Claude Code sửa file hoặc nhận prompt. Lỗi không chặn Claude, nhưng hiện ra liên tục. Git hook không bị vì đã có `command -v nightowl` kiểm tra trước; hook Claude Code thì chưa.
- Muốn dùng NightOwl một mình trên repo chung thì phải tự sửa tay để không lộ hook ra team.

Ngoài ra chưa có cách gỡ NightOwl: phải tự tìm và xoá từng mục trong hai file settings và hai git hook.

Mục tiêu giai đoạn 2 là "2–3 team trong công ty". Trước đó cần cài được cho một người mà không làm phiền người khác.

## What Changes

- **Mặc định ghi vào `.claude/settings.local.json`** (file cá nhân). `init` đảm bảo file này bị git bỏ qua: nếu `git check-ignore` báo chưa, thêm `.claude/settings.local.json` vào `.gitignore`.
- **Tuỳ chọn `nightowl init --shared`** ghi vào `.claude/settings.json` như trước, cho team đã thống nhất dùng chung.
- **Không bao giờ có hook ở cả hai file.** Nếu NightOwl đã có hook ở file kia, `init` không thêm vào file mới, chỉ báo hook đang nằm ở đâu và cách chuyển (`nightowl uninstall` rồi `init` lại).
- **Hook Claude Code chịu được máy chưa cài.** Lệnh hook đổi từ `nightowl log` thành `command -v nightowl >/dev/null 2>&1 && nightowl log >/dev/null 2>&1 || true`. `init` nâng cấp hook dạng cũ đang có thành dạng mới.
- **Lệnh mới `nightowl uninstall`:**
  - gỡ hook NightOwl (dạng cũ và mới) khỏi cả hai file settings, và gỡ dòng NightOwl khỏi hai git hook;
  - giữ nguyên mọi cấu hình và hook khác; xoá file nào chỉ còn lại phần NightOwl đã tạo;
  - giữ `.nightowl/` (dữ liệu) và các dòng `.gitignore`, rồi in đường dẫn để người dùng tự xoá nếu muốn;
  - với repo dùng `core.hooksPath` (husky), không sửa gì trong đó mà in dòng cần tự xoá.
- Không thêm file cấu hình hay biến môi trường.

Ngoài phạm vi:
- Chọn bật hoặc tắt từng hook riêng lẻ.
- Cài NightOwl ở mức người dùng (`~/.claude/settings.json`) cho mọi repo.
- Tự di chuyển hook giữa hai file settings.

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `project-setup`: chọn file settings (cá nhân hoặc chung), hook Claude Code an toàn khi máy chưa cài, lệnh `uninstall`.
- `cli`: `init` nhận tuỳ chọn `--shared`; đăng ký lệnh `uninstall`.

## Impact

- Code:
  - `src/setup/claude-settings.ts`: chọn file, nhận diện hook cũ và mới, nâng cấp, gỡ.
  - `src/setup/git-hook.ts`: gỡ dòng NightOwl.
  - `src/setup/gitignore.ts`: kiểm tra file đã bị git bỏ qua chưa.
  - `src/commands/init.ts`: tuỳ chọn `--shared`.
  - `src/commands/uninstall.ts`: lệnh mới.
- README: phần cài đặt và gỡ.
- Hành vi mặc định đổi: repo cài mới sẽ có hook trong `settings.local.json`. Repo đã cài từ trước giữ nguyên chỗ cũ.
- Không đổi schema, không thêm dependency, không truy cập mạng.
