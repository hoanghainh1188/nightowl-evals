## ADDED Requirements

### Requirement: Entry interactive cho review
`nightowl review` SHALL chấp nhận cờ `-i` / `--interactive` để vào chế độ TUI mô tả trong capability `review-tui`. Khi không có cờ đó, hành vi list/show/mark hiện tại SHALL không đổi.

#### Scenario: Không -i thì giữ CLI cũ
- **WHEN** chạy `nightowl review` không `-i`
- **THEN** in list văn bản như trước (không raw mode)
