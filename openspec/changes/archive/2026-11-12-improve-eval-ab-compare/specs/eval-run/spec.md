# Spec Delta

## ADDED Requirements

### Requirement: Nhãn thí nghiệm trên run
`nightowl eval` SHALL chấp nhận cờ nhãn đã document (ví dụ `--label <id>`) và gắn nhãn đó vào metadata của file kết quả JSONL trong `.nightowl/runs/` (header/sidecar/field đã document). Nhãn không hợp lệ (rỗng hoặc ký tự cấm đã document) SHALL lỗi trước khi gọi model. Không có `--label` SHALL vẫn chạy như hiện tại (metadata label null/absent).

#### Scenario: Ghi label vào kết quả
- **WHEN** chạy `nightowl eval --yes --label rules-v2` thành công
- **THEN** artifact trong `.nightowl/runs/` mang metadata label `rules-v2` (đọc lại được bởi lệnh compare)

### Requirement: Xuất báo cáo A/B sau khi chạy
Với cờ đã document (ví dụ `--report md|html` và/hoặc `-o` cho báo cáo), sau khi chạy `--yes` và ghi JSONL, `nightowl eval` SHALL sinh thêm báo cáo so sánh A/B cùng semantics capability `eval-ab-compare` (bảng model, case bất đồng; baseline nếu `--baseline` được truyền). Không có cờ report SHALL giữ bảng text stdout hiện có. Dry-run không `--yes` SHALL mô tả report sẽ ghi nếu cờ có mặt, và SHALL NOT gọi model.

#### Scenario: Report HTML sau eval
- **WHEN** chạy `nightowl eval --yes --report html -o .nightowl/eval-report.html` với ≥1 case được chấm
- **THEN** file HTML báo cáo tồn tại; JSONL runs vẫn được ghi; mã thoát theo quy tắc eval hiện có
