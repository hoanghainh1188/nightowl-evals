## ADDED Requirements

### Requirement: Lỗi AI tự sửa theo phản hồi
Khi commit-check khớp HEAD có bản bị phản hồi, và database xác nhận prompt phản hồi là prompt cùng phiên nằm giữa lần sửa đó và một lần AI sửa file sau nó, post-commit SHALL tạo một bản ghi lỗi nguồn `ai-self-fix`: nội dung AI là ảnh chụp bản bị phản hồi, nội dung cuối là bản commit, kèm prompt ban đầu và prompt phản hồi. Mỗi file trong mỗi commit có tối đa một lỗi `ai-self-fix`. Lỗi sửa tay (`manual-fix`) vẫn được tạo như trước, và có thể cùng tồn tại.

#### Scenario: AI sửa đúng sau phản hồi, dev không sửa tay
- **WHEN** AI ghi `age > 18`, dev phản hồi, AI sửa thành `age >= 18`, dev commit đúng bản đó
- **THEN** có đúng một bản ghi lỗi, nguồn `ai-self-fix`, với `ai_content` chứa `age > 18`, `final_content` chứa `age >= 18`, và `feedback_event_id` trỏ tới prompt phản hồi

#### Scenario: Phản hồi chỉ để thêm code
- **WHEN** AI viết một hàm, dev nhắn "thêm hàm kiểm tra email", AI chỉ thêm dòng mới, rồi dev commit
- **THEN** không có bản ghi lỗi nào được tạo

#### Scenario: AI sửa sau phản hồi, dev còn sửa tay
- **WHEN** AI sửa lại sau phản hồi, rồi dev sửa tay thêm một dòng khác trước khi commit
- **THEN** có hai bản ghi lỗi cho file đó: một `ai-self-fix` và một `manual-fix`

#### Scenario: Dev xoá dòng, AI chỉ thêm
- **WHEN** AI viết ba dòng, dev nhắn "thêm dòng d", AI chỉ thêm dòng d, rồi dev tự xoá một dòng cũ và commit
- **THEN** chỉ có một bản ghi lỗi, nguồn `manual-fix`

#### Scenario: Payload trỏ sai prompt
- **WHEN** `feedback_event_id` trong commit-check trỏ tới một prompt của phiên khác
- **THEN** không có lỗi `ai-self-fix` nào được tạo

#### Scenario: Commit không mang bản đã kiểm tra
- **WHEN** check có bản bị phản hồi nhưng blob được stage không phải blob trong HEAD
- **THEN** không có lỗi `ai-self-fix` nào được tạo từ check đó
