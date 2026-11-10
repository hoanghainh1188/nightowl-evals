# Proposal

## Why

Người dùng gõ `nightowl` hàng ngày phải nhớ subcommand và flag. Roadmap #24: lệnh `nightowl completion <bash|zsh|fish>` in script completion để tab-complete lệnh và tuỳ chọn — zero deps, chỉ local.

## What Changes

- Thêm lệnh `nightowl completion <shell>` với `shell` ∈ `bash|zsh|fish`: in script completion ra stdout, thoát 0.
- Script gợi ý mọi lệnh con đã đăng ký và các flag chính (ít nhất các lệnh user-facing trong roadmap: init, doctor, prune, report, review, classify, eval, export, uninstall, … kể cả completion).
- `completion --help` / shell không hợp lệ: báo rõ, thoát ≠ 0 khi shell sai; help thoát 0.
- README: cách cài (eval / source) cho từng shell.
- Không network; không ghi file trừ khi user tự redirect.

## Capabilities

### New Capabilities

- `shell-completion`: sinh và in script tab-completion cho Bash, Zsh, Fish

### Modified Capabilities

- `cli`: đăng ký lệnh `completion` và liệt kê trong help tổng

## Impact

- `src/commands/completion.ts` (+ module `src/completion/` nếu cần).
- Đăng ký trong `src/commands/index.ts`.
- Tests: stdout chứa tên lệnh/flag; shell invalid.
