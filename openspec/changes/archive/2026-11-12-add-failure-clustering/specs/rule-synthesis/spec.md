# Spec Delta

## ADDED Requirements

### Requirement: suggest-rules dùng cluster fingerprint
`nightowl suggest-rules` SHALL gom failure theo cùng định nghĩa cluster của capability `failure-clustering` (category + module + agent + fingerprint khi có nội dung), không chỉ category+module+agent. Ngưỡng `--min-count` và `--limit` vẫn áp dụng trên các cluster đó. Hành vi LLM opt-in / không ghi file mặc định SHALL không đổi.

#### Scenario: Hai failure cùng fingerprint tạo một cluster rules
- **WHEN** hai failure `confirmed` cùng category/module/agent và cùng fingerprint rồi chạy `nightowl suggest-rules --min-count 2`
- **THEN** chúng đóng góp vào đúng một cluster đề xuất (count ≥ 2), không tách thành hai nhóm chỉ vì khác path file trong cùng module
