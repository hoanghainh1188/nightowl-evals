## ADDED Requirements

### Requirement: Phân loại offline không mạng
`nightowl classify --offline` (hoặc cờ tương đương đã document) SHALL phân loại failure chưa có category bằng heuristic local deterministic, không gọi mạng, không yêu cầu `--yes`, không chạy `claude` / Anthropic API. Chỉ gán một trong bốn category hiện có. Khi không khớp rule đủ tin cậy, bản ghi SHALL giữ `category` null (unclassified).

#### Scenario: Offline gán category
- **WHEN** có failure unclassified khớp heuristic convention (hoặc rule đã document) và chạy `nightowl classify --offline`
- **THEN** bản ghi có `category` hợp lệ, `classifier` nhận diện nguồn heuristic, `classified_at` được ghi; không request mạng; mã thoát 0 nếu không lỗi khác

#### Scenario: Offline không khớp thì bỏ qua
- **WHEN** failure unclassified không khớp heuristic nào đủ tin cậy và chạy `classify --offline`
- **THEN** bản ghi vẫn unclassified; lệnh không fail chỉ vì bỏ qua

#### Scenario: Offline không cần --yes
- **WHEN** chạy `classify --offline` không có `--yes`
- **THEN** vẫn ghi category heuristic khi khớp; không mở dry-run LLM thay cho ghi DB

### Requirement: Offline tôn trọng đã phân loại và limit
Offline path SHALL bỏ qua failure đã có category trừ khi `--redo`. SHALL tôn trọng `--limit` (cùng bound đã document với classify LLM). SHALL NOT tạo `.nightowl/` / DB mới (cùng quy tắc “không tự init” như classify hiện có).

#### Scenario: Bỏ qua đã có category
- **WHEN** failure đã có category heuristic hoặc LLM và chạy `classify --offline` không `--redo`
- **THEN** category/classifier không đổi

#### Scenario: Redo offline ghi đè
- **WHEN** failure đã có category và chạy `classify --offline --redo` với heuristic khớp category khác
- **THEN** category/classifier/reason/confidence được cập nhật từ heuristic

### Requirement: LLM vẫn opt-in và có thể ghi đè heuristic
Đường LLM (`classify --yes`, transport cli|api) SHALL giữ nguyên: không gửi dữ liệu ra ngoài khi thiếu `--yes`. Khi `--yes` (và `--redo` nếu bản ghi đã có category), LLM MAY ghi đè kết quả heuristic. Không `--redo` → bỏ qua bản ghi đã có category (kể cả heuristic), như hành vi hiện tại.

#### Scenario: LLM dry-run không đổi DB
- **WHEN** chạy `classify` không `--yes` và không `--offline`
- **THEN** hành vi dry-run LLM hiện tại giữ nguyên; DB không đổi vì LLM; không bắt buộc chạy heuristic

#### Scenario: LLM redo ghi đè heuristic
- **WHEN** failure đã classifier heuristic và chạy `classify --yes --redo` với LLM trả category hợp lệ
- **THEN** bản ghi cập nhật category và `classifier` nguồn LLM

### Requirement: Classifier nguồn heuristic ổn định
Khi ghi kết quả offline, NightOwl SHALL đặt `classifier` thành giá trị ổn định đã document nhận diện heuristic (ví dụ `heuristic` hoặc `heuristic:<rule-id>`), `category_reason` ngắn giải thích rule khớp, và `category_confidence` trong [0, 1] theo rule. SHALL NOT lưu tên developer.

#### Scenario: Classifier heuristic
- **WHEN** offline classify thành công một failure
- **THEN** `classifier` bắt đầu bằng `heuristic` (hoặc đúng token đã document); reason không rỗng
