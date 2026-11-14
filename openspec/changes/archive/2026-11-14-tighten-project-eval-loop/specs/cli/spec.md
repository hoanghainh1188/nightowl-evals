## ADDED Requirements

### Requirement: Help nêu vòng eval project local
`nightowl --help` và/hoặc `--help` của `export`, `eval`, `eval-compare`, `suggest-regressions`, `digest`, `dashboard` (khi áp dụng) SHALL đề cập vòng local suite → eval → compare/digest (hoặc trỏ README). Help SHALL NOT hứa sync cloud hay leaderboard SaaS.

#### Scenario: export --help có vòng hoặc next eval
- **WHEN** chạy `nightowl export --help`
- **THEN** stdout đề cập `eval` / label / vòng eval hoặc bước tiếp theo local

#### Scenario: help không hứa cloud eval
- **WHEN** chạy `nightowl eval --help` hoặc `nightowl --help`
- **THEN** không hứa sync/cloud ranking
