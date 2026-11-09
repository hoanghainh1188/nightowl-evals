## ADDED Requirements

### Requirement: Chọn transport CLI hoặc API
`nightowl classify` SHALL chấp nhận `--transport cli|api` (mặc định `cli`). `cli` giữ hành vi gọi `claude` CLI hiện tại. `api` SHALL dùng Anthropic Messages API qua HTTPS. Giá trị khác SHALL bị từ chối, mã thoát 1, không gọi model.

#### Scenario: Mặc định cli
- **WHEN** chạy `nightowl classify --yes` không có `--transport`
- **THEN** NightOwl gọi `claude` CLI như hiện tại

#### Scenario: Transport không hợp lệ
- **WHEN** chạy `nightowl classify --transport foo`
- **THEN** stderr báo lỗi, mã thoát 1, không gọi model

### Requirement: API chỉ chạy khi opt-in và có key
Với `--transport api`, không có `--yes` thì SHALL NOT gửi HTTP. Dry-run SHALL nêu transport `api`, model, và host `api.anthropic.com`. Với `--yes --transport api`, key lấy từ `ANTHROPIC_API_KEY`; thiếu hoặc rỗng SHALL báo lỗi, không đổi DB, mã thoát 1. Key SHALL NOT được in ra stdout/stderr hay ghi vào DB/log NightOwl.

#### Scenario: Dry-run api
- **WHEN** chạy `nightowl classify --transport api` không có `--yes`
- **THEN** stdout nêu sẽ dùng API; không request HTTP nào được gửi; DB không đổi

#### Scenario: Thiếu API key
- **WHEN** chạy `nightowl classify --yes --transport api` mà `ANTHROPIC_API_KEY` trống
- **THEN** stderr báo thiếu key, DB không đổi, mã thoát 1

### Requirement: API dùng cùng hợp đồng phân loại
Khi `--transport api --yes` thành công, NightOwl SHALL gửi cùng nội dung prompt đã cắt giới hạn như CLI, yêu cầu JSON theo schema phân loại hiện có, parse/validate giống CLI (loại lạ → thất bại, không ghi category), và tôn trọng `--limit`, `--redo`, khoá classify, và timeout tương đương (huỷ request quá hạn).

#### Scenario: Phân loại qua API thành công
- **WHEN** chạy `nightowl classify --yes --transport api` với key hợp lệ và API trả category hợp lệ
- **THEN** bản ghi được lưu `category` / reason / confidence / classifier / classified_at như đường CLI

#### Scenario: API trả JSON không hợp lệ
- **WHEN** API trả body không parse được thành classification hợp lệ
- **THEN** bản ghi giữ nguyên chưa phân loại và được đếm thất bại
