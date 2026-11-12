# Design

## Context

See proposal.md — Why. Quan sát hiện tại:

- `moduleOf` (`src/report/module.ts`) chỉ `split('/')` — path `src\\hooks\\a.ts` → module sai.
- `findNearestWorkspace` / discover đã `replace(/\\/g, '/')`; `moduleLabel` fallback depth chưa normalize trước `moduleOf`.
- `ensureDataDir` / `ensurePrivateDir` luôn `chmod` tới `0o700` và so `(mode & 0o777) !== 0o700` — trên win32 có thể throw hoặc vô nghĩa.
- `installGitHook` `chmod(..., 0o755)` khi tạo mới; doctor đã skip execute-bit trên win32.

## Goals / Non-Goals

**Goals:**

- Helper chuẩn hóa path relative (separator) dùng cho module + workspace match.
- Private dir / data-dir: trên `win32` best-effort chmod, không fail chỉ vì mode; POSIX giữ `0700`.
- Hook install: trên `win32` bỏ qua / nuốt lỗi chmod execute; vẫn ghi nội dung hook.
- Tests stub platform + path `\\`; README Windows blurb.
- macOS / Linux không regress.

**Non-Goals:**

- Full Windows ACL modeling; WSL-only docs as primary.
- Đổi kill process group; schema DB; dependency mới.

## Decisions

1. **Shared `normalizeRepoPath(rel)`** — Export từ `src/shared/` hoặc tái dùng pattern workspace: `\\` → `/`, trim `./`. `moduleOf` và `moduleLabel` gọi normalize trước khi depth/workspace. Không đổi path tuyệt đối ổ đĩa (`C:\...`) trong scope này — chỉ relative repo paths đã lưu trong store/events.

2. **Private mode on win32** — `ensureDataDir` / `ensurePrivateDir`: nếu `process.platform === 'win32'`, sau mkdir + symlink/directory checks: try `chmod(0o700)` trong try/catch; **không** so sánh `(mode & 0o777) !== 0o700` để throw/re-chmod loop. Inject `platform` optional cho test khi cần.

3. **Hook chmod** — Trong `installGitHook` khi `created`: try chmod 0o755; trên win32 catch/ignore. Hoặc skip chmod khi platform win32.

4. **Docs** — README ngắn (init/doctor hoặc “Windows”); không thêm flag CLI.

5. **Alternatives rejected:** Luôn require WSL; map NTFS ACL qua `icacls` — fragile, out of scope.

## Risks / Trade-offs

- [Mode “nới” trên Windows] → Document rõ privacy best-effort; vẫn refuse symlink.
- [Path absolute Windows lọt vào store] → Out of scope nếu chưa có; normalize chỉ relative; nếu gặp absolute, giữ printable hiện tại / không bịa.
- [Tests trên macOS giả win32] → Stub platform + fake chmod throw đủ cover.

## Migration Plan

- Không migration schema; không BREAKING POSIX.
- Archive: tick #41 trong `docs/v0.6-roadmap-ideas.md`.

## Open Questions

- Có cần doctor warn khi `.nightowl` mode “rộng” trên POSIX only? **Giữ hiện tại** — change này không thêm doctor mode check mới.
