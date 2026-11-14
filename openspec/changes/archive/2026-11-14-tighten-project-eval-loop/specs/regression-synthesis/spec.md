## ADDED Requirements

### Requirement: Suggest-regressions gợi ý vòng eval
Khi `nightowl suggest-regressions` ghi fixture/stub thành công (có cờ ghi tường minh), stderr SHALL gồm gợi ý bước tiếp theo trong vòng project-eval-loop (ví dụ chạy `eval` trên suite liên quan, hoặc `export` rồi `eval --label`). SHALL NOT gọi mạng; SHALL NOT bịa thêm test patch ngoài khung đã ghi.

#### Scenario: Ghi output thành công có Next
- **WHEN** chạy `suggest-regressions` với `--output` (hoặc tương đương) và ghi thành công
- **THEN** stderr chứa gợi ý bước eval/export trong vòng đã document
