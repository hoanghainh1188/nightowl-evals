## MODIFIED Requirements

### Requirement: Opt-in chạy lệnh kiểm thử sau mỗi đầu ra model
Với `--test-command <cmd>` và `--yes`, sau mỗi đầu ra file hợp lệ NightOwl SHALL ghi nội dung vào `filePath` của bài trong thư mục chạy test của bài (worktree cô lập theo mặc định, project root khi `--isolation in-place`), chạy `<cmd>` với cwd là thư mục đó, rồi khôi phục file. Không có `--test-command` thì không chạy shell test. Không có `--yes` thì SHALL NOT chạy test.

#### Scenario: Dry-run có test command
- **WHEN** chạy `nightowl eval --test-command "npm test"` không có `--yes`
- **THEN** stdout nêu lệnh test và chế độ isolation sẽ dùng; không tiến trình model, test hay git worktree nào chạy; mã thoát 0

#### Scenario: Chạy test sau đầu ra hợp lệ
- **WHEN** chạy `nightowl eval --yes --test-command "npm test"` và model trả file hợp lệ
- **THEN** NightOwl ghi file vào thư mục chạy test của bài, chạy `npm test` tại đó, khôi phục file, và ghi kết quả test vào dòng JSONL của bài đó

#### Scenario: Không có --test-command
- **WHEN** chạy `nightowl eval --yes` không có `--test-command`
- **THEN** không lệnh shell kiểm thử nào được chạy và không worktree nào được tạo; điểm textual giữ như hiện tại

### Requirement: Khôi phục file an toàn
Trước khi ghi, NightOwl SHALL backup nội dung file đích (hoặc ghi nhận chưa tồn tại). Sau test (ok/fail/timeout) SHALL restore backup, kể cả khi test lỗi. Restore thất bại SHALL báo lỗi, thoát mã 1, và không tiếp tục ghi đè im lặng. Ở chế độ `worktree`, file trong cây làm việc của developer SHALL NOT bị ghi.

#### Scenario: Test fail vẫn khôi phục
- **WHEN** lệnh test thoát mã 1
- **THEN** nội dung file trên disk sau bài đó giống như trước khi ghi đầu ra model

#### Scenario: Worktree không chạm cây làm việc
- **WHEN** chạy `nightowl eval --yes --test-command "npm test"` với isolation mặc định
- **THEN** file `filePath` ở project root không bị ghi trong suốt lần chạy

## ADDED Requirements

### Requirement: Cô lập lệnh test trong git worktree
`nightowl eval` SHALL nhận `--isolation worktree|in-place` (mặc định `worktree`); giá trị khác SHALL thoát mã 1 trước khi gọi model. Ở chế độ `worktree`, với mỗi bài có `commit_sha` hợp lệ (hex 7–64 ký tự), NightOwl SHALL tạo một `git worktree` detached tại parent của `commit_sha` dưới `.nightowl/worktrees/`, dùng chung cho mọi model của bài, và SHALL gỡ nó sau bài kể cả khi lỗi.

#### Scenario: Test chạy tại parent của commit lỗi
- **WHEN** bài có `commit_sha` C và chạy với `--yes --test-command <cmd>`
- **THEN** `<cmd>` chạy với cwd là một worktree ở commit `C^`, có đầu ra model tại `filePath`; worktree bị gỡ sau bài

#### Scenario: Giữ hành vi cũ
- **WHEN** chạy với `--isolation in-place`
- **THEN** lệnh test chạy ở project root như trước; không worktree nào được tạo

### Requirement: Dọn worktree còn sót
Đầu mỗi lần `eval --yes` có `--test-command` ở chế độ `worktree`, NightOwl SHALL xoá mọi thư mục dưới `.nightowl/worktrees/` và chạy `git worktree prune`.

#### Scenario: Lần chạy trước bị huỷ
- **WHEN** `.nightowl/worktrees/` còn thư mục từ lần chạy bị Ctrl-C
- **THEN** lần chạy kế tiếp xoá thư mục đó trước khi tạo worktree mới

### Requirement: Bài không có base commit
Ở chế độ `worktree`, bài không có `commit_sha` hợp lệ hoặc không resolve được parent SHALL NOT chạy test; dòng JSONL ghi `tests_passed` null và `tests_error` nêu lý do. Không tạo được worktree SHALL ghi `tests_passed` false kèm lý do. Các bài khác vẫn chạy. Với `--require-tests`, `pass` SHALL là false khi `tests_passed` khác true.

#### Scenario: Bài không có commit
- **WHEN** bài không có `commit_sha` và chạy với `--require-tests`
- **THEN** không lệnh test nào chạy cho bài đó; `tests_error` nêu thiếu base commit; `pass` là false

### Requirement: Setup command trong worktree
Với `--setup-command <cmd>` (chỉ hợp lệ cùng `--test-command`; thiếu thì thoát mã 1 trước khi gọi model), NightOwl SHALL chạy `<cmd>` đúng một lần trong mỗi worktree mới, trước lần test đầu tiên, với cùng timeout `--test-timeout`. Setup thoát khác 0 hoặc timeout SHALL ghi test của mọi model trong bài đó là không đạt với `tests_error` bắt đầu bằng `setup failed`. Ở `--isolation in-place`, `--setup-command` SHALL bị từ chối với mã 1.

#### Scenario: Setup một lần cho nhiều model
- **WHEN** chạy hai model trên một bài với `--setup-command "npm ci"`
- **THEN** `npm ci` chạy một lần trong worktree của bài, trước hai lần chạy test
