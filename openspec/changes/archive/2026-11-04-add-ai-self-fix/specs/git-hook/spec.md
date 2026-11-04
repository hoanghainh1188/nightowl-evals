## ADDED Requirements

### Requirement: Ghi nhận bản AI bị phản hồi
Pre-commit SHALL tìm *bản bị phản hồi* của mỗi file: lần AI sửa mà sau nó, trong cùng phiên Claude Code, dev gửi một prompt rồi AI sửa lại file đó và bỏ hoặc đổi ít nhất một dòng của lần sửa ấy (so với bản AI sau cùng, không chỉ khác khoảng trắng). Lần sửa của phiên khác xen giữa, và lần sửa của một commit bị huỷ trước đó, vẫn được xét. Có nhiều thì lấy lần sớm nhất. Commit-check SHALL ghi id lần sửa, id prompt phản hồi và số dòng AI thêm, bỏ.

#### Scenario: AI sửa lại sau phản hồi
- **WHEN** trong một phiên, AI ghi `age > 18`, dev gửi prompt "sai rồi, từ 18", AI sửa thành `age >= 18`, rồi dev stage file và commit
- **THEN** commit-check của file ghi bản bị phản hồi là lần sửa đầu, prompt phản hồi là prompt thứ hai, và có 1 dòng bị bỏ

#### Scenario: AI chỉnh nhiều lần trong một lượt
- **WHEN** AI sửa một file hai lần liên tiếp mà không có prompt nào của dev ở giữa
- **THEN** commit-check không có bản bị phản hồi

#### Scenario: Prompt ở phiên khác
- **WHEN** giữa hai lần AI sửa một file ở phiên A, chỉ có prompt ở phiên B
- **THEN** commit-check không có bản bị phản hồi

#### Scenario: Phiên khác sửa xen giữa
- **WHEN** phiên A sửa file, phiên B sửa file, dev gửi prompt ở phiên A, rồi phiên A sửa lại và đổi dòng nó đã viết
- **THEN** commit-check ghi bản bị phản hồi là lần sửa đầu của phiên A

#### Scenario: Commit trước bị huỷ
- **WHEN** AI sửa, dev phản hồi, AI sửa lại, dev commit nhưng commit bị huỷ, AI sửa thêm, rồi dev commit lại
- **THEN** commit-check của lần commit sau vẫn ghi bản bị phản hồi là lần sửa đầu

#### Scenario: Chỉ dev xoá dòng
- **WHEN** AI viết ba dòng, dev nhắn "thêm dòng d", AI chỉ thêm dòng d, rồi dev tự xoá một dòng cũ trước khi commit
- **THEN** commit-check không có bản bị phản hồi
