## ADDED Requirements

### Requirement: Cột agent trên events
Schema mới SHALL thêm cột `agent` (TEXT, có thể null cho sự kiện `git` thuần) trên `events`, với CHECK hoặc validation ứng dụng theo danh sách agent hỗ trợ cộng `unknown`. Migration SHALL chạy tự động khi `nightowl init` / mở store ghi.

#### Scenario: Migration từ bản cũ
- **WHEN** mở DB chỉ có source `claude-code`/`git` không có cột agent
- **THEN** migration thêm cột; sự kiện `claude-code` cũ nhận `agent='claude-code'`; sự kiện `git` nhận `agent` null

### Requirement: Agent trên failures khi có snapshot
Khi tạo failure từ snapshot agent, bản ghi SHALL lưu `agent` của edit AI tương ứng để report/filter.

#### Scenario: Failure từ Cursor
- **WHEN** post-commit tạo failure từ edit `cursor`
- **THEN** hàng `failures` có `agent` là `cursor`
