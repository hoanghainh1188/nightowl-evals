## ADDED Requirements

### Requirement: Filter review theo agent
`nightowl review` SHALL hỗ trợ `--agent <id>` (lặp được) để liệt kê failure theo agent.

#### Scenario: review --agent cursor
- **WHEN** có failure `cursor` và `claude-code`
- **THEN** `nightowl review --agent cursor` chỉ hiện failure `cursor`
