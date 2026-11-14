## ADDED Requirements

### Requirement: Export gợi ý bước eval tiếp theo
Khi `nightowl export` ghi file suite thành công (không phải chỉ `--privacy-dry-run` / stdout-only trừ khi design chọn in cả stdout), stderr SHALL gồm gợi ý next-step trỏ tới `nightowl eval` với `--label` và nhắc giữ file private. SHALL NOT gọi mạng.

#### Scenario: Export file thành công
- **WHEN** chạy `export` ghi `.nightowl/export/evals.jsonl` thành công
- **THEN** stderr chứa gợi ý chứa `eval` và `--label`

### Requirement: Export lọc failure confirmed (tuỳ chọn)
`nightowl export` SHALL chấp nhận bộ lọc status đã document (ví dụ `--status confirmed`) để chỉ xuất failure không dismissed khớp status. Khi không truyền filter, hành vi mặc định hiện tại (mọi non-dismissed) SHALL giữ nguyên — không BREAKING.

#### Scenario: Chỉ confirmed
- **WHEN** store có confirmed và flagged; chạy `export --status confirmed` (hoặc tương đương)
- **THEN** file chỉ gồm case từ failure confirmed

#### Scenario: Không filter giữ mặc định
- **WHEN** chạy `export` không status filter
- **THEN** vẫn xuất mọi failure non-dismissed như trước change
