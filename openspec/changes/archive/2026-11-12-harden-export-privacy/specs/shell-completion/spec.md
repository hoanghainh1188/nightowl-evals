# Spec Delta

## ADDED Requirements

### Requirement: Completion flag privacy
Catalog completion SHALL gồm các flag privacy mới trên `export` (ít nhất `--redact-paths` và `--privacy-dry-run` hoặc tên đã document), và flag coarsen path trên các lệnh báo cáo nếu chúng hỗ trợ.

#### Scenario: Catalog export có redact-paths
- **WHEN** dựng catalog completion
- **THEN** entry `export` gồm flag privacy đã document
