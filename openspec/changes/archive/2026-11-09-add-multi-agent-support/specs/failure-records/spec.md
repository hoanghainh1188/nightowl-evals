## ADDED Requirements

### Requirement: Ghép failure theo đúng agent của snapshot
Khi nhiều agent sửa cùng file, post-commit SHALL gắn failure tới snapshot edit **cùng agent** gần nhất phù hợp (không lấy nhầm snapshot Claude cho phiên Cursor).

#### Scenario: Cursor rồi Claude trên một file
- **WHEN** Cursor edit file, sau đó Claude Code edit cùng file, rồi commit bản khác Cursor
- **THEN** failure (nếu có) gắn agent/snapshot khớp lần edit bị sửa, không nhầm agent
