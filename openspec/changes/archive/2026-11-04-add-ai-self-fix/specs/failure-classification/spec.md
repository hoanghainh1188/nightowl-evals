## ADDED Requirements

### Requirement: Gửi kèm prompt phản hồi
Khi một lỗi có prompt phản hồi, `nightowl classify --yes` SHALL gửi kèm nội dung prompt đó trong prompt phân loại, với cùng giới hạn kích thước và cách escape như các phần khác. Không có `--yes` thì vẫn không gửi gì.

#### Scenario: Phân loại lỗi AI tự sửa
- **WHEN** chạy `nightowl classify --yes` với một lỗi `ai-self-fix` có prompt phản hồi
- **THEN** prompt gửi cho `claude` có khối `<feedback>` chứa nội dung prompt phản hồi
