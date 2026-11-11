# Spec Delta

## ADDED Requirements

### Requirement: Completion cho dashboard
Catalog completion SHALL gồm subcommand `dashboard` và các flag tài liệu hoá của lệnh đó (ít nhất `--since`, `--depth`, `--agent`, `--output`, `-o`, `--open`). Script Bash/Zsh/Fish sinh từ catalog SHALL gợi ý các mục này khi tab sau `nightowl` / `nightowl dashboard`.

#### Scenario: catalog có dashboard
- **WHEN** kiểm tra catalog completion của package
- **THEN** có khóa/entry `dashboard` kèm các flag `--output` và `--open`
