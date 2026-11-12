# Proposal

## Why

Kill process group trên Windows đã ổn, nhưng DX local còn lệch: path dùng `\` có thể làm module/workspace/report không khớp (nhiều chỗ chỉ `split('/')`), `.nightowl/` bắt `chmod 0700` theo POSIX trong khi NTFS không bảo đảm cùng semantics, và cài git hook vẫn `chmod 755` dù execute-bit trên Windows không tương đương. Siết path + permission fallback + document giúp máy team Windows dùng NightOwl tin được — vẫn local-only, không SaaS.

## What Changes

- **Chuẩn hóa path** end-to-end cho nhãn module, workspace match/filter, và so khớp path đã document: `\` và `/` được coi tương đương (relative trong repo); unit test với fixture path kiểu Windows.
- **Private dir / `.nightowl/`**: trên POSIX giữ `0700`; trên `win32` best-effort `chmod` — nếu mode không áp dụng được / không đọc được như POSIX, vẫn dùng thư mục thật (không symlink), **không** fail cứng chỉ vì bit mode; document giới hạn NTFS trong README/help liên quan.
- **Git hook install**: trên Windows tạo/cập nhật hook file gọi NightOwl thành công mà **không** yêu cầu execute-bit POSIX; `chmod` best-effort / no-op đã document (doctor đã skip execute-bit trên win32 — giữ).
- Cập nhật README (và help ngắn nếu cần) về Windows path + permission.
- **Không BREAKING** trên macOS/Linux semantics hiện có; không đổi kill process group đã ship.
- **Out of scope**: WSL-as-primary product surface, ACL editor phức tạp, SaaS, telemetry, chấm người, dependency runtime mới, đổi schema DB.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `local-storage`: nới/clarify semantics thư mục riêng tư trên Windows/NTFS (best-effort privacy mode; vẫn từ chối symlink).
- `project-setup`: `init` cài git hook trên Windows không phụ thuộc execute-bit; document hành vi.
- `failure-report`: nhãn module / path trong report SHALL normalize separator trước khi depth/workspace.
- `workspace-awareness`: filter/match path SHALL dùng cùng chuẩn hóa separator với discovery.
- `cli`: help/README (hoặc blurb lệnh liên quan) nêu giới hạn Windows path/permission đã document.

## Impact

- Code: `src/storage/data-dir.ts`, `src/shared/private-dir.ts`, `src/setup/git-hook.ts`, `src/report/module.ts` (+ helper path normalize dùng chung nếu tách), workspace match/label nếu còn sót `\`.
- Tests: unit path `packages\\ui\\src\\a.ts` → cùng module/workspace; private-dir/data-dir stub `win32` / chmod fail; hook install platform stub.
- Docs: README; tick ideation #41 khi archive.
- Không migration DB; không dependency mới; macOS / Linux giữ hành vi hiện tại.
