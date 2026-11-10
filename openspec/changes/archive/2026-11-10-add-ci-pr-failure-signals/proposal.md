# Proposal

## Why

NightOwl mới bắt được AI edit qua hook + git; test/build đỏ trên CI và comment review PR — hai tín hiệu product doc đã nêu — vẫn mất. Action hiện chỉ `report` trên DB sẵn có, không đưa fail CI hay review vào store. Cần ingest tín hiệu phụ local-first, không bịa `ai_content`, để team thấy lỗi AI làm hỏng CI / bị review bắt.

## What Changes

- Thêm lệnh CLI ingest (ví dụ `nightowl ingest-ci` / `nightowl ingest-pr`) đọc **file local** (JUnit XML, JSON summary, hoặc export comment) và ghi sự kiện/quan sát vào SQLite.
- Gắn commit SHA / đường dẫn test khi có; cố liên kết snapshot/agent gần nhất **best-effort**; **SHALL NOT** tạo failure đầy đủ với `ai_content` giả.
- Hỗ trợ tuỳ chọn ingest comment PR: mặc định từ file JSON người dùng/workflow ghi sẵn; gọi GitHub API **chỉ khi opt-in rõ** (cờ + token môi trường trong CI).
- Mở rộng Action (tuỳ chọn input): sau khi có artifact JUnit/summary, gọi ingest trước `report` — không bắt buộc.
- Report/review có thể lọc hoặc đếm tín hiệu CI/PR (text + JSON) mà không đổi nghĩa `manual-fix` / `ai-self-fix` hiện có trừ khi design chọn nguồn mới có document.
- Không telemetry; CLI mặc định không mạng.

## Capabilities

### New Capabilities

- `ci-pr-signals`: ingest tín hiệu CI fail và review PR vào store local (file-first; GitHub API opt-in), liên kết agent/commit khi suy ra được, không bịa nội dung AI

### Modified Capabilities

- `cli`: đăng ký lệnh ingest + help
- `local-storage`: schema/events (và migration nếu cần) cho loại sự kiện CI/PR
- `failure-report`: hiển thị/đếm tín hiệu CI/PR trong cửa sổ báo cáo (và JSON)
- `github-action`: input/bước tuỳ chọn chạy ingest từ artifact trước gate `report`
- `shell-completion`: gợi ý lệnh/flag ingest mới

## Impact

- Lệnh mới dưới `src/commands/`, parser JUnit/JSON dưới `src/ingest/` (hoặc tương đương), migration SQLite, cập nhật Action + README.
- Tests: fixture JUnit → event; không mạng khi không opt-in; Action docs.
- Phạm vi một change; triển khai theo phase trong tasks (CI file → PR file → API opt-in → Action).
