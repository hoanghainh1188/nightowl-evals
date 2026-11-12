# Proposal

## Why

`nightowl doctor` đã đủ health cơ bản (Node, git, hooks file, DB, report readiness khi 0 failure), nhưng khi onboard 2–3 máy team vẫn thiếu tín hiệu: monorepo có workspace config mà discovery trống, hook/marker “có file” nhưng cấu trúc tool khó đọc, và tóm tắt sẵn sàng report chưa gồm signals / mẫu failure hữu ích. Làm sâu doctor local giúp team tự kiểm trước khi tin `report` / CI gate — không SaaS, không mạng.

## What Changes

- Thêm kiểm tra **workspace awareness** trong `doctor`: khi repo có cấu hình workspace đã hỗ trợ (`package.json` workspaces / `pnpm-workspace.yaml`), cảnh báo nếu discovery trả về rỗng; khi có package thì báo số package (ok).
- Làm sâu kiểm tra **hook/agent authenticity** (local): ngoài tồn tại file, xác minh cấu trúc mà tool đọc được (JSON hợp lệ + NightOwl entries; git hook executable / gọi đúng lệnh; conflict Claude shared vs local đã có thì giữ/mở rộng rõ).
- Mở rộng **report readiness summary**: ngoài cảnh báo 0 failure, tóm tắt số failure không dismissed, có/không signals (ci-fail / pr-review / revert) trong cửa sổ mặc định đã document; vẫn warn không fail (trừ `--strict`).
- Cập nhật `--help` / README ngắn cho các kiểm tra mới.
- **Không BREAKING** mặc định: check mới là warn; `--strict` vẫn fail khi có warn.
- **Out of scope**: SaaS/team dashboard, gọi mạng để “verify” hook với API tool, auto-fix hooks, telemetry, chấm người / hiện tên developer.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `project-setup`: mở rộng yêu cầu `doctor` — workspace discovery, authenticity hook/agent sâu hơn, readiness summary (failures + signals).
- `cli`: `doctor --help` nêu các nhóm kiểm tra mới (workspace / readiness / authenticity).
- `workspace-awareness`: doctor MAY/Shall dùng discovery đã document khi kiểm tra monorepo (delta hành vi quan sát được qua doctor).

## Impact

- Code: `src/commands/doctor.ts` (+ helper nhỏ nếu tách), tái sử dụng `src/workspace/discover.ts`, queries store/events cho signals.
- Tests: `test/commands/doctor.test.ts` (+ fixture monorepo).
- Docs: README mục doctor nếu có; tick ideation #40 khi archive.
- Không migration DB; không dependency mới; macOS / Linux / Windows (path normalize `/`).
