# Spec Delta

## ADDED Requirements

### Requirement: doctor help nêu workspace và readiness team
`nightowl doctor --help` SHALL nêu rằng lệnh còn kiểm tra workspace/monorepo (khi có config), authenticity cấu hình hook/agent, và tóm tắt sẵn sàng report (failures + signals), ngoài các kiểm tra môi trường/hook đã có.

#### Scenario: doctor --help có workspace/readiness
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập workspace hoặc monorepo và readiness/report hoặc signals
