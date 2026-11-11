# Spec Delta

## ADDED Requirements

### Requirement: Completion cho customer-report
Catalog completion SHALL gồm subcommand `customer-report` và các flag tài liệu hoá của lệnh đó (ít nhất `--lang`, `--format`, `--since`, `--depth`, `--agent`, `--output`, `-o`). Script Bash/Zsh/Fish sinh từ catalog SHALL gợi ý các mục này khi tab sau `nightowl` / `nightowl customer-report`.

#### Scenario: catalog có customer-report
- **WHEN** kiểm tra catalog completion của package
- **THEN** có khóa/entry `customer-report` kèm các flag `--lang` và `--format`
