# Tasks

## 1. Khung package

- [x] 1.1 Tạo `package.json` (`name`, `version: 0.1.0`, `type: module`, `bin.nightowl`, `engines.node >=22.13`, `files`, `"license": "Apache-2.0"`, `publishConfig.access: public`, `dependencies: {}`); kiểm tra bằng `npm pkg get license` trả `"Apache-2.0"`
- [x] 1.2 Cài dev dependency `typescript`, `tsup`, `vitest`, `@vitest/coverage-v8`, `@types/node`; kiểm tra `npm ls --depth=0` không lỗi và `dependencies` vẫn rỗng
- [x] 1.3 Thêm `tsconfig.json` (strict, `module`/`moduleResolution: NodeNext`, `resolveJsonModule`), `tsup.config.ts`, `vitest.config.ts` (coverage v8, ngưỡng 80%) và script `build`, `test`, `test:coverage`, `typecheck`; kiểm tra `npm run typecheck` chạy được
- [x] 1.4 Thêm `.gitignore` (`node_modules/`, `dist/`, `coverage/`, `.nightowl/`); kiểm tra `git status` không hiện các thư mục đó

## 2. Lõi CLI

- [x] 2.1 Viết test trước cho `run()`: `--version`, `--help`, không tham số, lệnh lạ (scenarios trong `specs/cli/spec.md`); xác nhận test fail
- [x] 2.2 Cài `src/cli/io.ts`, `src/cli/help.ts`, `src/cli/run.ts` và bảng lệnh `src/commands/index.ts`; kiểm tra test 2.1 pass
- [x] 2.3 Thêm `src/cli/main.ts` và `src/cli/guards.ts` (bắt lỗi theo design mục 4, có unit test) và `src/bin.ts` (gán `process.exitCode`); kiểm tra `npm run build` tạo `dist/bin.js` có shebang

## 3. Lệnh con rỗng

- [x] 3.1 Viết test cho `init`, `report`, `export`: in "chưa triển khai" ra stderr, thoát 0, không tạo file trong thư mục tạm; xác nhận fail rồi cài để pass
- [x] 3.2 Viết test cho `log`: JSON hợp lệ, `not json`, stdin rỗng, stdin là TTY, lỗi khi đọc stdin, đọc stdin có timeout → luôn thoát 0, stdout/stderr rỗng; xác nhận fail rồi cài `src/commands/log.ts` để pass

## 4. Chính sách và e2e

- [x] 4.1 Thêm `test/policy/no-network.test.ts`: `dependencies` rỗng và `src/` không import module mạng hay gọi `fetch`; kiểm tra test pass
- [x] 4.2 Thêm `test/e2e/bin.test.ts` với `beforeAll` build bằng tsup: chạy `node dist/bin.js --version`, `--help`, `reprot`, pipe `not json` vào `log`, stdin không đóng, stdout bị đóng sớm; kiểm tra mã thoát và output khớp spec
- [x] 4.3 Chạy `npm run test:coverage`; kiểm tra mọi test pass và coverage ≥ 80%
- [x] 4.4 Chạy `npm pack --dry-run`; kiểm tra gói chỉ chứa `dist/`, `LICENSE`, `NOTICE`, `package.json`
- [x] 4.5 Chạy `npm link` rồi `nightowl --help` ở thư mục khác; kiểm tra lệnh chạy được, sau đó `npm unlink -g @hoanghainh/nightowl-evals`

## Workflow follow-up

- Viết README ngắn (cài đặt, lệnh) khi có lệnh đầu tiên chạy thật ở `add-claude-code-hook`.
- Archive change sau khi được duyệt và merge.
