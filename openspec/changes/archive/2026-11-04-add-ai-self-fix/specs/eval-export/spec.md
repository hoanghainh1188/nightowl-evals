## ADDED Requirements

### Requirement: Xuất nguồn lỗi và prompt phản hồi
Mỗi dòng `nightowl export` SHALL có thêm trường `source` (nguồn của lỗi) và `input.feedback` (nội dung prompt phản hồi, `null` khi không có). `schema` vẫn là `nightowl.eval/v1` và `id` không đổi. `nightowl eval` SHALL NOT gửi `input.feedback` cho model.

#### Scenario: Lỗi AI tự sửa
- **WHEN** xuất một lỗi `ai-self-fix` có prompt phản hồi "sai rồi, từ 18"
- **THEN** dòng tương ứng có `source` là `ai-self-fix` và `input.feedback` là "sai rồi, từ 18"

#### Scenario: Lỗi sửa tay
- **WHEN** xuất một lỗi `manual-fix`
- **THEN** dòng tương ứng có `source` là `manual-fix` và `input.feedback` là `null`

#### Scenario: Eval không lộ gợi ý
- **WHEN** chạy `nightowl eval --yes` trên một ca có `input.feedback`
- **THEN** prompt gửi cho model không chứa nội dung của `input.feedback`
