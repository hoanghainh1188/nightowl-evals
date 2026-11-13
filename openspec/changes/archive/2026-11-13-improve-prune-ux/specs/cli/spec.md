# Spec Delta

## ADDED Requirements

### Requirement: prune help nêu bytes, profile và vacuum size
`nightowl prune --help` SHALL mô tả ước lượng bytes trên dry-run/prune, retention `--profile` (và quan hệ với `--days`), và tóm tắt dung lượng DB khi `--vacuum`.

#### Scenario: prune --help có profile/bytes
- **WHEN** chạy `nightowl prune --help`
- **THEN** stdout đề cập `--profile` (hoặc retention profile) và bytes hoặc disk/size / vacuum summary
