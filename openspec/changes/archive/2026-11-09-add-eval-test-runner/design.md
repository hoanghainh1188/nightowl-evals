# Design

## Context

`nightowl eval` gọi `claude -p`, parse toàn bộ nội dung file, rồi `scoreOutput` so dòng với `rejected`/`expected`. Không có bước chạy test. Xem proposal.md — Why. Ràng buộc: opt-in, không telemetry mới, runtime dependency tối thiểu (chỉ Node built-in).

## Goals / Non-Goals

**Goals:**
- Cho phép xác minh execution bằng một lệnh shell người dùng chỉ định.
- Ghi kết quả song song với điểm textual; tuỳ chọn gắn `pass` tổng với test.
- An toàn file: backup → ghi → test → restore, tuần tự, có timeout.

**Non-Goals:**
- Không tự suy ra lệnh test từ `package.json` / CI config (phiên bản sau).
- Không container / sandbox OS đầy đủ; tin người dùng với lệnh họ chọn.
- Không chạy song song nhiều worktree; không hỗ trợ multi-file patch trong một case.
- Không đổi format schema export `nightowl.eval/v1`.

## Decisions

1. **Cờ CLI thay vì file cấu hình**
   - `--test-command <string>`, `--test-timeout <seconds>` (default 120), `--require-tests`.
   - Lý do: khớp các opt-in hiện có (`--yes`, `--model`); không thêm schema config.
   - Thay thế đã xét: `.nightowl/eval.json` — trì hoãn.

2. **Ghi đè file tại project root + restore**
   - Case eval gắn một `filePath` trong repo; ghi output vào đúng path, chạy lệnh với `cwd = projectRoot`.
   - Lý do: `npm test` / `pytest` cần `node_modules` / venv sẵn có; worktree đầy đủ nặng và dễ lệch dependency.
   - Thay thế đã xét: temp worktree + symlink `node_modules` — phức tạp hơn lợi ích P2.

3. **Chạy tuần tự khi có `--test-command`**
   - Tránh race ghi cùng file giữa model/case.
   - Không có test command: giữ vòng lặp hiện tại (có thể tuần tự sẵn).

4. **Spawn shell**
   - POSIX: `/bin/sh -c <cmd>`; Windows: `process.env.ComSpec` / `cmd.exe /c`.
   - Huỷ bằng cơ chế cross-platform đã có (cùng hướng `run-claude`).
   - Truncate stdout/stderr ghi vào kết quả (ví dụ 8 KB) để JSONL không phình.

5. **`pass` và metrics**
   - Luôn ghi `tests_passed` / `tests_exit_code` / `tests_error`.
   - `score` textual không đổi công thức.
   - `--require-tests`: `pass = textualPass && tests_passed === true`.
   - Bảng stdout thêm cột hoặc dòng phụ “tests passed” khi bật.

6. **Lời gọi model thất bại**
   - Không chạy test; `tests_passed = null`.

## Risks / Trade-offs

- [Lệnh test phá môi trường / xoá file khác] → Chỉ document; restore chỉ đảm bảo file case; người dùng tự chọn lệnh an toàn.
- [Crash giữa chừng để lại file model] → `try/finally` restore; nếu restore fail thì dừng run và báo rõ.
- [Test flaky / chậm] → timeout + `--limit`; người dùng chọn lệnh hẹp (`npm test -- path`).
- [Windows path / shell] → dùng ComSpec; test trên CI Linux là chính, thêm unit mock spawn.

## Migration Plan

- Không migration DB. Người dùng cũ không truyền flag → hành vi cũ.
- README / help cập nhật ví dụ `nightowl eval --yes --test-command "npm test"`.
- Sau khi ổn định, tick P2 trong `docs/production-readiness.md` khi archive.

## Open Questions

- Có nên thêm biến môi trường `NIGHTOWL_EVAL_FILE` trỏ file vừa ghi để lệnh test chỉ chạy subset không? Có thể bổ sung sau nếu không đổi spec cốt lõi (có thể ghi vào help như convenience không bắt buộc).
