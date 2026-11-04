# Design

## Context

Xem proposal.md. Hành vi: `specs/project-setup`, `specs/claude-code-hook`. Dựa trên `openStore` / `insertEvent` của change 2 và lớp an toàn của `log` từ change 1 (đọc stdin tối đa 500 ms, luôn thoát 0).

Payload hook của Claude Code (JSON trên stdin) có các trường chung `session_id`, `transcript_path`, `cwd`, `hook_event_name`. `PostToolUse` thêm `tool_name`, `tool_input`, `tool_response`; `UserPromptSubmit` thêm `prompt`. Với `UserPromptSubmit`, mọi thứ hook in ra stdout khi thoát 0 sẽ bị chèn vào ngữ cảnh của Claude, nên `log` phải tuyệt đối không in gì.

## Goals / Non-Goals

**Goals:**
- Lưu đủ dữ liệu cho change 4: ảnh chụp file sau mỗi lần AI sửa.
- `init` an toàn với cấu hình người dùng: chỉ thêm, không ghi đè, không xoá.

**Non-Goals:**
- Đọc `transcript_path` để lấy thêm ngữ cảnh (để change 5 cân nhắc).
- Gỡ hook (`uninstall`).

## Decisions

### 1. Ảnh chụp file đọc từ đĩa lúc hook chạy
`PostToolUse` chạy sau khi tool đã ghi file, nên đọc file lúc đó là đúng bản AI vừa tạo. `tool_input` của `Edit` chỉ có đoạn `old_string`/`new_string`, không đủ để dựng lại cả file.
*Phương án khác:* dựng lại file từ chuỗi các `Edit`: phức tạp và sai khi dev sửa xen giữa; đọc `tool_response`: định dạng không ổn định giữa các bản Claude Code.

### 2. Ghi vào `.claude/settings.json` như doc chốt
Theo đúng doc. Lệnh hook là `nightowl log` (không dùng `npx`, vì `npx` thêm vài trăm ms mỗi lần gọi). `init` cảnh báo nếu `nightowl` không có trong `PATH`. Hook đặt `"timeout": 5` giây làm giới hạn trên phía Claude Code.
Khi team dùng (giai đoạn 2), có thể thêm cờ `--local` để ghi vào `.claude/settings.local.json` (file cá nhân, không commit). Chưa làm trong change này.

### 3. Nhận diện hook của NightOwl khi gộp
Một hook được coi là của NightOwl khi `command` bằng đúng `nightowl log`. Khi gộp: tìm nhóm có cùng `matcher`; nếu đã có hook đó thì bỏ qua, nếu chưa thì thêm nhóm mới. Ghi file bằng cách ghi ra file tạm cùng thư mục rồi `rename`, giữ thụt lề 2 dấu cách và xuống dòng cuối file.

### 4. Kiểm tra payload bằng type guard viết tay
Chỉ cần vài trường; tự viết `parseHookPayload(unknown): HookPayload | null` thay vì thêm `zod`, giữ nguyên chính sách không có dependency lúc chạy.

### 5. Gốc dự án lấy từ `cwd` trong payload
Ưu tiên `payload.cwd`, rồi tới `process.cwd()`. Đường dẫn file được chuẩn hoá bằng `realpath` trước khi kiểm tra có nằm trong gốc dự án không, để chặn đường đi vòng qua symlink. Nếu cả thư mục cha cũng không resolve được thì bỏ qua sự kiện. `.git`/`.nightowl` so không phân biệt hoa thường (macOS, Windows). Ảnh chụp đọc bằng `O_NOFOLLOW` để không đi theo symlink được tráo vào sau bước kiểm tra.

### 5b. Không lưu nội dung nhạy cảm
File có tên thuộc nhóm bí mật (`src/hooks/claude-code/sensitive.ts`: `.env*`, khoá, `credentials`, `secrets.*`…) hoặc bị git bỏ qua (`git check-ignore -q`, giới hạn 300 ms; lỗi thì coi như không bị bỏ qua) chỉ được lưu đường dẫn và lý do (`snapshot_skipped: "sensitive" | "ignored"`), không lưu nội dung hay phần thay đổi. File bị bỏ qua không bao giờ vào commit nên cũng không cần cho change 4.

### 6. Log lỗi
`.nightowl/nightowl.log`, mỗi dòng: thời điểm ISO, tên hook, mã lỗi hoặc thông báo ngắn (tối đa 200 ký tự, thư mục home thay bằng `~`). Không ghi payload, code hay prompt. stdin không đóng kịp được ghi riêng, khác với payload hỏng. Khi file vượt 1 MB thì xoá nội dung cũ và ghi tiếp (log chỉ để debug, mất cũng không sao).

### 7. Payload sự kiện

```jsonc
// kind = "prompt"
{ "prompt": "…", "truncated": false }
// kind = "edit"
{ "tool": "Edit", "input": { "old_string": "…", "new_string": "…", "replace_all": false },
  "snapshot": "<nội dung file>", "snapshot_skipped": null }   // hoặc "too_large" | "unreadable"
```
`tool_response` không được lưu (trùng lặp và lớn).

## Risks / Trade-offs

- [Dev sửa file trong khoảng giữa lúc AI ghi và lúc hook đọc] → Khoảng này vài chục ms; chấp nhận.
- [Định dạng payload hook của Claude Code có thể đổi] → Type guard trả `null` thì chỉ ghi log lỗi; test dùng payload mẫu cố định trong `test/fixtures/`.
- [Hook thêm khoảng 60–100 ms (khởi động Node và mở SQLite) mỗi lần AI sửa file] → Đo trong test e2e; nếu vượt 1 giây thì test fail.
- [`.claude/settings.json` được commit nên ảnh hưởng người khác trong repo] → Đã ghi trong proposal; cờ `--local` để giai đoạn 2.
