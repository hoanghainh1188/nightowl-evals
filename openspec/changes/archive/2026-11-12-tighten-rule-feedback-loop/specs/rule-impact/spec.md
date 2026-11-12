# Spec Delta

## ADDED Requirements

### Requirement: Gợi ý xem impact sau mark
Khi `nightowl rule-impact mark` ghi bản rule-applied thành công, lệnh SHALL in trên stderr (hoặc stdout text rõ ràng đã document) gợi ý bước tiếp local: chạy lệnh xem impact (mặc định show) và/hoặc `digest` / `dashboard` để thấy tóm tắt. Lệnh SHALL NOT gọi mạng/LLM và SHALL NOT đổi hành vi `report` / CI gate.

#### Scenario: Mark thành công kèm next-step
- **WHEN** repo đã init và chạy `nightowl rule-impact mark --label convention-naming` thành công
- **THEN** output/stderr nhắc xem impact (ví dụ chạy `nightowl rule-impact` hoặc digest/dashboard); thoát 0; store có bản applied tương ứng label
