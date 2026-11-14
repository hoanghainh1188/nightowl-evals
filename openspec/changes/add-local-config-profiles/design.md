# Design

## Context

See proposal.md — Why. Hiện CLI parse flag độc lập (`node:util` `parseArgs`) trong từng command; không có file config. `.nightowl/` đã gitignore toàn bộ (DB + artifacts). Team cần defaults **commit được** tách khỏi DB máy-local. macOS / Linux / Windows: path relative repo root, JSON UTF-8, không phụ thuộc execute-bit.

## Goals / Non-Goals

**Goals:**
- Loader/merge/validate JSON thuần Node, không dependency mới.
- Precedence ổn định: CLI > `.nightowl/config.local.json` > `nightowl.config.json` > built-in.
- Wiring tối thiểu vào report / digest / prune / privacy surfaces + doctor + init mẫu.
- Fail closed trên config hỏng / unknown key / forbidden secret-ish keys.

**Non-Goals:**
- TOML/YAML parsers, remote fetch, encrypt secrets, multi-profile named switcher UI.
- Bắt GitHub Action đọc config (follow-up).
- Đổi schema SQLite hay hook behavior.

## Decisions

1. **Đường dẫn file**
   - Project (commit): `nightowl.config.json` ở git root (cạnh package root / repo root NightOwl đã resolve như các lệnh khác).
   - Local overlay: `.nightowl/config.local.json`.
   - **Alternatives:** chỉ `.nightowl/config.json` (không share qua git); `nightowl.toml` (thêm parser). Chọn JSON root + overlay vì khớp gitignore hiện có và zero deps.

2. **Schema v1 (camelCase keys)**
   ```json
   {
     "version": 1,
     "failOnRate": 25,
     "agents": ["claude-code"],
     "workspaces": ["packages/app"],
     "digest": { "lookbackDays": 7 },
     "prune": { "profile": "default" },
     "privacy": { "redactPaths": true }
   }
   ```
   - Unknown top-level hoặc nested key → validate error (tránh typo âm thầm).
   - Forbidden keys (case-insensitive match trên mọi object): `apiKey`, `api_key`, `token`, `password`, `secret`, `authorization` → error.
   - `version` bắt buộc; chỉ `1` ở change này.

3. **`--config <path>`**
   - Override **project** file path (không thay overlay trừ khi path trỏ vào overlay có chủ đích). Dùng cho test/CI. Relative path resolve từ cwd/repo root như flag path khác.

4. **Apply điểm**
   - Sau `parseArgs`, trước business logic: `loadNightowlConfig({ root, configPath? })` → `ResolvedConfig`.
   - Chỉ fill khi CLI value “absent” (undefined), không khi user truyền giá trị bằng default flag nếu parseArgs không phân biệt — với `parseArgs` hiện tại, absent = key undefined. Boolean flags: nếu config muốn `redactPaths: true` mà CLI không có `--redact-paths`, set effective true; `--no-redact-paths` trên share-pack vẫn thắng.

5. **doctor / init**
   - Doctor: check mới “config” — missing both = pass (info “using built-in defaults”); present+valid = pass; invalid = fail.
   - Init: nếu thiếu `nightowl.config.json`, ghi `{ "version": 1 }\n`; không đụng overlay; không overwrite.

6. **Hooks**
   - Không đọc config trong hot path hook/log (tránh I/O/fail trên mọi commit). Chỉ lệnh user-facing đã liệt kê.

## Risks / Trade-offs

- **[Risk] Typo key làm CI đỏ** → Mitigation: unknown key fail + doctor + README example.
- **[Risk] Team commit secret vào config** → Mitigation: forbidden key list + docs; không phải vault hoàn chỉnh.
- **[Risk] Boolean flag asymmetry** (`--redact-paths` vs share `--no-redact-paths`) → Mitigation: document effective default matrix trong README; tests từng lệnh.
- **[Risk] Windows path trong `workspaces`** → Mitigation: reuse workspace matching hiện có (normalize separators).

## Migration Plan

1. Ship loader + doctor/init; lệnh chưa wire vẫn an toàn.
2. Wire report → digest → prune → privacy surfaces.
3. README + example snippet; không migration DB.
4. Rollback: xóa/đổi tên file config → hành vi cũ.

## Open Questions

- Có mở rộng `depth` / `baselineSince` vào config v1+ không — **không** trong change này (tránh phình schema).
