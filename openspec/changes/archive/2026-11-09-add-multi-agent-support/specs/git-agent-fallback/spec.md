## Purpose

Khi thiếu snapshot hook của agent, vẫn gắn ngữ cảnh tối thiểu từ git để failure detection không bỏ sót hoàn toàn, mà không bịa nội dung AI.

## ADDED Requirements

### Requirement: Fallback chỉ khi thiếu snapshot
Ở pre-commit/post-commit, nếu file staged/committed **không** có snapshot edit agent gần đây đủ điều kiện, NightOwl SHALL áp git-agent-fallback thay vì im lặng bỏ qua mọi tín hiệu.

#### Scenario: Có snapshot agent
- **WHEN** file có edit `cursor` trong cửa sổ hợp lệ trước commit
- **THEN** dùng snapshot đó; không tạo bản ghi fallback trùng

#### Scenario: Không có snapshot
- **WHEN** file đổi ở commit nhưng không có edit agent gần đây
- **THEN** ghi sự kiện/ đánh dấu fallback theo quy tắc dưới; không điền `ai_content` giả

### Requirement: Heuristic session branch và unknown-agent
Fallback SHALL cố gắn `agent` từ tên nhánh dạng session/agent nếu nhận diện được; nếu không, dùng `agent` đặc biệt `unknown` (hoặc tương đương đã document) và ghi metadata nguồn `git-fallback` trong payload.

#### Scenario: Nhánh có tín hiệu Cursor
- **WHEN** nhánh hiện tại khớp pattern session đã document và không có snapshot
- **THEN** fallback gắn agent `cursor` (hoặc agent suy ra từ pattern) trong metadata

#### Scenario: Không suy ra được
- **WHEN** không khớp pattern nào
- **THEN** gắn `unknown` và vẫn cho phép so diff commit vs working tree chỉ như tín hiệu phụ — **SHALL NOT** tạo failure `manual-fix` đầy đủ nếu thiếu `ai_content`

### Requirement: Không bịa nội dung AI
Git-agent-fallback SHALL NOT bịa nội dung file AI. Failure records đầy đủ (có `ai_content`) chỉ tạo khi có snapshot ingest thật.

#### Scenario: Chỉ có git diff
- **WHEN** chỉ có fallback git không có snapshot
- **THEN** không chèn hàng `failures` với `ai_content` bịa; tối đa sự kiện quan sát / metric “unattributed change”
