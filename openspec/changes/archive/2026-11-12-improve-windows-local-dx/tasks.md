# Tasks

## 1. Path normalize

- [x] 1.1 Thêm helper `normalizeRepoPath` (+ unit test `\\` / `./` / trailing)
- [x] 1.2 Wire vào `moduleOf` / `moduleLabel` (và workspace match nếu còn sót); test `src\\hooks\\a.ts` → `src/hooks` và workspace `packages\\ui\\…`

## 2. Private dir + hooks trên win32

- [x] 2.1 `ensureDataDir` / `ensurePrivateDir`: win32 best-effort chmod, không fail vì mode; test stub platform / chmod throw
- [x] 2.2 `installGitHook`: skip hoặc ignore chmod execute trên win32; test platform stub; POSIX giữ executable khi tạo mới

## 3. Docs + validate

- [x] 3.1 README (và help init/doctor nếu gọn) nêu Windows path / NTFS / hook limits
- [x] 3.2 `npm test` + typecheck + `openspec validate improve-windows-local-dx` xanh

## Workflow follow-up

- Archive change sau review; tick #41 trong `docs/v0.6-roadmap-ideas.md` khi archive.
