# Design

## Context

Repo trống ngoài `docs/`, `openspec/`, `LICENSE`, `NOTICE`. Stack đã chốt trong `openspec/project.md`: TypeScript, Node 22+, tsup, vitest. Đây là change đầu tiên, nên các quyết định ở đây (cấu trúc thư mục, cách đăng ký lệnh, cách test) sẽ được 8 change sau dùng lại. Hành vi cần đạt nằm trong `specs/cli/spec.md`.

## Goals / Non-Goals

**Goals:**
- Lõi CLI test được mà không cần spawn process; chỉ một test e2e chạy bin thật.
- Thêm lệnh con mới chỉ cần thêm một file và một dòng đăng ký.
- `nightowl log` an toàn cho hook ngay từ đầu, để `add-claude-code-hook` chỉ cần thêm phần ghi dữ liệu.

**Non-Goals:**
- Parse tham số riêng của từng lệnh con (mỗi change sau tự làm).
- Cấu hình người dùng, file config, biến môi trường.
- CI, lint/format tự động, publish npm.

## Decisions

### 1. Không có dependency lúc chạy; parse cờ bằng `node:util` `parseArgs`
Chỉ cần `--help`, `--version` và tên lệnh con. `parseArgs` đủ dùng và không thêm gì vào cây phụ thuộc. Ít dependency giúp khách dễ kiểm tra rằng tool không gửi code ra ngoài.
*Phương án khác:* `commander` / `yargs` / `citty`: tiện hơn khi lệnh con có nhiều tuỳ chọn, nhưng thêm code bên thứ ba vào mọi lần hook chạy. Xem lại khi `report`/`export` cần nhiều cờ.

### 2. Lõi thuần: `run(argv, io) → Promise<number>`
`src/cli/run.ts` nhận mảng tham số và một đối tượng `io` (`stdout`, `stderr`, `stdin`), trả về mã thoát. `src/cli/main.ts` bọc `run` để bắt lỗi chưa xử lý; `src/bin.ts` chỉ nối `process` vào `main` rồi gán `process.exitCode`. Không gọi `process.exit()` để stdout được ghi xong trước khi thoát.
*Phương án khác:* ghi thẳng `console.log` và `process.exit`: nhanh hơn lúc viết, nhưng unit test phải mock global và dễ cắt cụt output.

### 3. Bảng lệnh dạng mảng chỉ đọc
`src/commands/index.ts` xuất mảng `readonly Command[]`, mỗi phần tử `{ name, summary, run }`. Mỗi lệnh nằm một file trong `src/commands/`. `--help` sinh từ chính bảng này nên luôn khớp với các lệnh có thật.

### 4. `log`: nuốt mọi lỗi, đọc stdin có giới hạn thời gian
Toàn bộ thân lệnh nằm trong `try/catch` và luôn trả 0. Nếu `stdin.isTTY` (người dùng gõ tay) thì bỏ qua bước đọc để không treo. Ngược lại đọc stdin tối đa `LOG_STDIN_TIMEOUT_MS` = 500 ms; quá hạn thì huỷ stream và dùng phần đã đọc. Claude Code đóng stdin ngay sau khi ghi event, nên chỉ pipe bị kẹt mới chạm giới hạn này. Hiện tại payload đọc xong rồi bỏ; `add-claude-code-hook` sẽ ghi nó vào SQLite.
Có hai lớp an toàn bên ngoài:
- `main()` bắt lỗi ném ra từ lệnh: với `log` thì trả 0, với lệnh khác thì in lỗi ra stderr và trả 1.
- `installProcessGuards()` trong `bin.ts` bỏ qua lỗi ghi trên stdout/stderr (EPIPE) và xử lý `uncaughtException`/`unhandledRejection` theo cùng quy tắc đó.

### 5. Build: tsup, ESM, một file đầu ra
Entry `src/bin.ts` → `dist/bin.js`, `format: esm`, `target: node22`, banner `#!/usr/bin/env node`. `package.json`: `"type": "module"`, `"bin": { "nightowl": "dist/bin.js" }`, `"engines": { "node": ">=22.13" }`, `"files": ["dist", "LICENSE", "NOTICE"]`, `"license": "Apache-2.0"`, `"publishConfig": { "access": "public" }`.
Phiên bản lấy bằng `import pkg from '../package.json' with { type: 'json' }`; tsup đưa giá trị vào lúc build nên chỉ có một nơi khai báo phiên bản.
*Mốc Node 22.13:* từ bản này `node:sqlite` dùng được không cần `--experimental-sqlite`, mà `add-local-storage` cần nó. Khoá luôn mốc này để khỏi phải đổi `engines` sau.

### 6. Test
- Unit (vitest): gọi `run()` với `io` giả cho từng scenario trong spec.
- E2E: `beforeAll` trong file e2e build bằng tsup một lần (để chạy riêng unit test không phải build), rồi spawn `node dist/bin.js` để kiểm tra shebang, mã thoát và pipe stdin cho `log`.
- Yêu cầu "không truy cập mạng": test khẳng định `dependencies` trong `package.json` rỗng và không file nào trong `src/` import `node:net`, `node:http`, `node:https`, `node:dgram`, `node:tls` hay gọi `fetch`. Đây là kiểm tra tĩnh, đủ cho khung; các change sau giữ nguyên test này.
- Coverage qua `@vitest/coverage-v8`, ngưỡng 80% cấu hình trong `vitest.config.ts`. `src/bin.ts` (3 dòng nối process) được loại khỏi coverage vì chỉ chạy trong subprocess e2e.

### Cấu trúc thư mục

```text
src/
├── bin.ts              # nối process → main
├── cli/
│   ├── main.ts         # bắt lỗi từ lệnh, `log` luôn thoát 0
│   ├── guards.ts       # EPIPE, uncaughtException, unhandledRejection
│   ├── errors.ts       # HOOK_COMMAND, errorMessage
│   ├── run.ts          # parse cờ, chọn lệnh, mã thoát
│   ├── help.ts         # sinh text --help từ bảng lệnh
│   └── io.ts           # kiểu Io + io thật từ process
└── commands/
    ├── command.ts      # kiểu Command
    ├── index.ts        # bảng lệnh
    ├── not-implemented.ts
    ├── init.ts
    ├── log.ts
    ├── report.ts
    └── export.ts
test/
├── cli/{run,main,io,guards}.test.ts
├── commands/not-implemented.test.ts
├── commands/log.test.ts
├── e2e/bin.test.ts
└── policy/no-network.test.ts
```

## Risks / Trade-offs

- [`parseArgs` không có lệnh con lồng nhau] → Chỉ parse cờ toàn cục trước tên lệnh; phần còn lại chuyển nguyên cho lệnh con. Đổi sang thư viện khi thật sự cần.
- [Test mạng chỉ kiểm tra tĩnh, có thể bỏ sót cách gọi gián tiếp] → Chấp nhận ở khung. Khi thêm dependency runtime đầu tiên, phải xem lại test này trong change đó.
- [E2E cần build trước, test chậm hơn] → Chỉ một file e2e, build một lần trong `beforeAll`.
- [Lệnh rỗng thoát 0 có thể làm người dùng tưởng đã chạy xong] → Luôn in "chưa triển khai" ra stderr; chưa có ai dùng bản này ngoài tác giả.
