## ADDED Requirements

### Requirement: Report breakdown theo nguồn phân loại
`nightowl report` (text và `--json`) SHALL gồm count (và tỷ lệ % tùy text) trong cửa sổ lọc hiện tại cho ba nhóm nguồn: classified-by-heuristic, classified-by-llm, và unclassified. Phân loại nguồn SHALL dựa trên `classifier` đã document (heuristic vs LLM) và `category` null → unclassified. Dismissed SHALL không đếm vào các nhóm này theo cùng quy tắc total hiện có. SHALL NOT lộ tên developer.

#### Scenario: JSON có nguồn phân loại
- **WHEN** store có failure heuristic, failure LLM, và unclassified; chạy `nightowl report --json`
- **THEN** JSON có khoá ổn định (ví dụ `by_classifier_source` hoặc tương đương) với count heuristic, llm, unclassified khớp dữ liệu

#### Scenario: Text nêu nguồn
- **WHEN** chạy `nightowl report` (text) trên cùng dữ liệu
- **THEN** stdout có dòng/tóm tắt phân biệt heuristic vs llm vs unclassified
