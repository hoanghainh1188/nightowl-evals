# Tasks

## 1. Discovery helper + doctor workspace

- [x] 1.1 Export/helper: detect “workspace config present” + reuse `discoverWorkspaces` (unit test: config+empty dirs warn path; config+packages ok; no config → no check)
- [x] 1.2 Wire workspace checks into `doctor` output (warn/ok); `--strict` exits 1 on warn

## 2. Authenticity + readiness

- [x] 2.1 POSIX execute-bit warn for NightOwl git hooks; skip on win32; tests with mode bits / platform stub
- [x] 2.2 Extend readiness summary: reportable failures + `SIGNAL_KINDS` counts; keep existing 0-failure warn; tests with seeded signals

## 3. Docs + validate

- [x] 3.1 Update `doctor --help` (+ README doctor blurb if present)
- [x] 3.2 `npm test` + typecheck + `openspec validate deepen-doctor-team-readiness` xanh
- [x] 3.3 Tick #40 khi archive
