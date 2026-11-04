# Design

## Context

Xem proposal.md. Hành vi cần đạt: `specs/local-storage/spec.md`. Ràng buộc chính: lệnh `log` (change 3) phải im lặng và nhanh; `node:sqlite` in `ExperimentalWarning` khi được import, trên cả Node 22.13 và 24 (đã kiểm tra trên máy).

## Goals / Non-Goals

**Goals:**
- API lưu trữ nhỏ, đồng bộ, dễ test bằng database trong thư mục tạm.
- Schema đủ cho change 3–5 mà không phải migration lại ngay.

**Non-Goals:**
- ORM, query builder, dọn dữ liệu cũ, xuất dữ liệu (change 8).

## Decisions

### 1. `node:sqlite` `DatabaseSync`, import động sau khi chặn cảnh báo
`src/storage/sqlite.ts` bọc `process.emitWarning` để bỏ đúng cảnh báo có `name === 'ExperimentalWarning'` và nội dung chứa `SQLite`, rồi mới `await import('node:sqlite')`. Bọc trước là bắt buộc vì import tĩnh sẽ được thực thi trước mọi code khác của bundle.
Build phải giữ tiền tố `node:` (`removeNodeProtocol: false` trong tsup): `node:sqlite` không có tên không tiền tố, bỏ tiền tố thì bundle không chạy được.
*Phương án khác:* shebang `#!/usr/bin/env -S node --no-warnings`: tắt mọi cảnh báo của mọi thư viện, và `env -S` không có trên mọi hệ thống; `better-sqlite3`: là native addon, cài chậm, trái quyết định trong doc.

### 2. Tìm gốc dự án bằng cách đi ngược tìm `.git`
Đi từ `cwd` lên thư mục cha cho tới khi gặp `.git` (thư mục hoặc file, để hỗ trợ worktree và submodule). Không gọi `git rev-parse` để khỏi tốn thêm một tiến trình con trong hook.

### 3. Schema v1

```sql
CREATE TABLE events (
  id          INTEGER PRIMARY KEY,
  created_at  TEXT    NOT NULL,              -- ISO 8601 UTC
  source      TEXT    NOT NULL CHECK (source IN ('claude-code', 'git')),
  kind        TEXT    NOT NULL,              -- prompt | edit | write | commit-check ...
  session_id  TEXT,
  file_path   TEXT,                          -- tương đối so với gốc dự án
  payload     TEXT    NOT NULL CHECK (json_valid(payload))
);
CREATE INDEX events_file_time ON events (file_path, created_at);
CREATE INDEX events_session   ON events (session_id, created_at);

CREATE TABLE failures (
  id             INTEGER PRIMARY KEY,
  created_at     TEXT NOT NULL,
  file_path      TEXT NOT NULL,
  ai_event_id    INTEGER REFERENCES events (id),
  ai_content     TEXT NOT NULL,
  final_content  TEXT NOT NULL,
  commit_sha     TEXT,
  category       TEXT CHECK (category IN ('logic', 'convention', 'misread-requirement', 'missing-context')),
  status         TEXT NOT NULL DEFAULT 'flagged' CHECK (status IN ('flagged', 'confirmed', 'dismissed'))
);
```

`kind` để dạng text tự do thay vì `CHECK` vì change 3 và 4 còn thêm loại mới; mỗi change tự kiểm tra giá trị mình ghi. 4 giá trị `category` theo 4 loại lỗi trong doc. Không có cột tên dev (nguyên tắc 5: chấm AI, không chấm người).

### 4. Migration bằng `PRAGMA user_version`
Mảng `migrations: readonly string[]`; phần tử thứ *i* đưa schema từ *i* lên *i+1*. Khi mở: đọc `user_version`, chạy các migration còn thiếu trong `BEGIN IMMEDIATE … COMMIT`, cập nhật `user_version` trong cùng transaction. Nếu `user_version` lớn hơn độ dài mảng → báo lỗi, không đụng vào file.

### 5. Đồng thời: WAL + `busy_timeout`
Khi mở: `journal_mode = WAL`, `busy_timeout = 2000`, `synchronous = NORMAL`, `foreign_keys = ON`. WAL cho phép đọc trong lúc ghi; `busy_timeout` cho tiến trình thứ hai chờ thay vì lỗi ngay. 2 giây khớp với ngân sách thời gian của hook.
Khi hai tiến trình cùng khởi tạo một database mới, lệnh chuyển sang WAL có thể trả `SQLITE_BUSY` ngay mà không chờ `busy_timeout` (đã tái hiện khi test). Vì vậy bước WAL + migration được bọc trong `retryWhileBusy` (thử lại mỗi 25 ms, tối đa 2 giây).

### 6. API

```ts
openStore(options?: { cwd?: string }): Promise<Store>   // tìm gốc, mở, migrate
interface Store {
  readonly root: string;
  insertEvent(event: NewEvent): StoredEvent;
  listEvents(filter?: { filePath?: string; since?: string; kinds?: readonly string[] }): readonly StoredEvent[];
  close(): void;
}
```
`openStore` là async chỉ vì import động ở mục 1; mọi thao tác sau đó đồng bộ. Đối tượng trả về là bất biến (`Object.freeze`).

## Risks / Trade-offs

- [`node:sqlite` còn thử nghiệm, API có thể đổi giữa các bản Node] → CI chạy cả Node 22.13 và 24; mọi chỗ gọi API nằm gọn trong `src/storage/`.
- [Chặn cảnh báo bằng cách bọc `process.emitWarning` là can thiệp toàn cục] → Chỉ bỏ đúng một cảnh báo theo tên và nội dung; mọi cảnh báo khác vẫn đi qua; có test.
- [Payload lớn làm phình DB] → Change 3 giới hạn kích thước payload trước khi ghi; change này không giới hạn.
