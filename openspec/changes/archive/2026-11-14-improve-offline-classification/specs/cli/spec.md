## ADDED Requirements

### Requirement: Help phân biệt offline và LLM classify
`nightowl classify --help` SHALL mô tả cờ offline (ví dụ `--offline`), rằng offline không gọi mạng và không cần `--yes`, và rằng LLM vẫn cần `--yes`. Help SHALL nêu LLM tắt mặc định.

#### Scenario: classify --help có offline
- **WHEN** chạy `nightowl classify --help`
- **THEN** stdout đề cập `--offline` (hoặc tên cờ đã chọn) và `--yes` cho LLM

#### Scenario: help chung không hứa SaaS classify
- **WHEN** chạy `nightowl --help` hoặc `nightowl help classify`
- **THEN** không hứa sync/cloud labeling; mô tả classify local
