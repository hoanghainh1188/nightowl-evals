# Spec Delta

## ADDED Requirements

### Requirement: report help nêu scope metrics với --workspace
`nightowl report --help` SHALL nêu rằng với `--workspace`, failures và `changedRate` (checks có path) bị thu hẹp theo package; signals mặc định vẫn full `--since`; và có thể cảnh báo khi `--fail-on-rate` kết hợp filter mà mẫu số không đủ scoped.

#### Scenario: report --help có scope metrics
- **WHEN** chạy `nightowl report --help`
- **THEN** stdout đề cập `--workspace` cùng changedRate/checks hoặc cảnh báo fail-on-rate / signals scope
