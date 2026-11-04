# Proposal

## Why

Repo hiện chỉ có doc, LICENSE và NOTICE, chưa có code. Tám change sau (`add-local-storage` … `add-eval-run`) đều cần sẵn một CLI `nightowl` build và test được, nên phải dựng khung này trước. Làm ngay ở tuần 1 để các change hook kịp chạy trên dự án thật.

## What Changes

- Tạo package npm `@hoanghainh/nightowl-evals` (TypeScript, ESM, Node ≥ 22.13), `"license": "Apache-2.0"`, phát hành kèm `LICENSE` và `NOTICE`.
- Thêm bin `nightowl` với:
  - `nightowl --help` / `nightowl` (không tham số): in hướng dẫn và danh sách lệnh.
  - `nightowl --version`: in phiên bản package.
  - Lệnh rỗng: `init`, `log`, `report`, `export`. Mỗi lệnh chỉ báo "chưa triển khai" và thoát 0. Change sau sẽ điền logic.
  - Lệnh lạ: báo lỗi kèm gợi ý `--help`, thoát mã khác 0.
- `nightowl log` đã giữ đúng hợp đồng của hook ngay từ khung: im lặng, đọc hết stdin, luôn thoát 0, kể cả khi lỗi.
- Build bằng tsup ra `dist/`, test bằng vitest (unit + một test chạy bin đã build), coverage ≥ 80%.
- Không có dependency lúc chạy. Chỉ dùng module có sẵn của Node.
- Thêm `.gitignore` cho repo (`node_modules/`, `dist/`, `coverage/`, `.nightowl/`).

Ngoài phạm vi: SQLite, ghi hook vào `.claude/settings.json`, git hook, CI, publish lên npm. Các phần này thuộc change sau.

## Capabilities

### New Capabilities

- `cli`: Lệnh `nightowl`: cách gọi lệnh con, `--help`, `--version`, mã thoát, và các lệnh đã đăng ký. Các change sau sẽ thêm hành vi của từng lệnh con vào capability này hoặc tạo capability riêng (ví dụ `claude-code-hook`, `local-storage`).

### Modified Capabilities

(không có — chưa có spec nào)

## Impact

- File mới: `package.json`, `package-lock.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`, `src/**`, `test/**`.
- Dev dependency: `typescript`, `tsup`, `vitest`, `@vitest/coverage-v8`, `@types/node`. Cài từ npm registry lúc dev; công cụ khi chạy không gọi mạng.
- Yêu cầu Node ≥ 22.13 (mốc `node:sqlite` dùng được không cần cờ thực nghiệm), khai báo trong `engines`.
- `LICENSE` (đã có, Apache-2.0) và `NOTICE` (vừa tạo) được đưa vào gói publish qua trường `files`.
