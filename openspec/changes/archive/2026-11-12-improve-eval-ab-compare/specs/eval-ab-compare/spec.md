# Spec Delta

## Purpose

Cho phép so sánh kết quả eval local (một run hoặc run vs baseline) thành bảng A/B dễ đọc (Markdown/HTML) với delta metrics và case bất đồng, không gọi model lại và không lộ danh tính developer.

## ADDED Requirements

### Requirement: Lệnh so sánh offline
NightOwl SHALL cung cấp lệnh tường minh đã document (ví dụ `eval-compare`) đọc một hoặc hai file kết quả JSONL trong `.nightowl/runs/` (hoặc đường dẫn `--input` / `--baseline` đã document), sinh báo cáo so sánh local, rồi thoát 0 khi thành công. Lệnh SHALL NOT gọi mạng hoặc LLM. Khi chưa init / thiếu file, SHALL lỗi rõ trên stderr và thoát ≠ 0.

#### Scenario: So sánh một run
- **WHEN** có file JSONL run hợp lệ và chạy lệnh compare với `--input` trỏ tới file đó
- **THEN** stdout hoặc file output chứa bảng theo model (ít nhất passed và mean score); mã thoát 0

#### Scenario: Thiếu file
- **WHEN** đường dẫn `--input` không tồn tại
- **THEN** stderr báo lỗi rõ; mã thoát ≠ 0; không gọi model

### Requirement: Delta vs baseline
Khi cung cấp baseline đã document (`--baseline <file>` hoặc tương đương), báo cáo SHALL gồm delta theo model cho các chỉ số đã document (ít nhất passed và/hoặc mean score) giữa run hiện tại và baseline. Khi không có baseline, SHALL vẫn in bảng run hiện tại và SHALL NOT bịa số delta.

#### Scenario: Có baseline
- **WHEN** so sánh run A với baseline B cùng tập model có điểm
- **THEN** báo cáo nêu delta (có dấu +/- hoặc tương đương) cho ít nhất một chỉ số theo model

### Requirement: Case bất đồng
Báo cáo SHALL liệt kê (có giới hạn độ dài đã document nếu cần) các `case_id` mà các model đã chấm không cùng pass/fail trên run hiện tại; lời gọi thất bại SHALL NOT bị tính như “không đạt” khi xác định bất đồng (cùng semantics `eval` hiện có).

#### Scenario: Hai model khác pass
- **WHEN** cùng `case_id` model X pass và model Y fail (cả hai có score)
- **THEN** báo cáo nêu `case_id` đó trong mục bất đồng

### Requirement: Xuất Markdown và HTML local
Lệnh SHALL hỗ trợ `--format md|html` (hoặc tương đương). Markdown mặc định in stdout trừ khi `-o`/`--output`; HTML self-contained ghi file (mặc định dưới `.nightowl/` khi không chỉ định). HTML SHALL NOT tải CDN/script ngoài. Báo cáo SHALL NOT chứa tên/email developer.

#### Scenario: HTML self-contained
- **WHEN** chạy compare với `--format html -o .nightowl/eval-compare.html`
- **THEN** file tồn tại, không chứa URL CDN `https://` cho script ngoài; mã thoát 0

### Requirement: Nhãn run và chú thích rule-impact
Khi metadata run có nhãn thí nghiệm (label) đã document, báo cáo SHALL hiển thị label (và label baseline nếu có). Khi mở được store và có bản rule-applied local, báo cáo SHALL nêu nhãn rule + thời điểm áp dụng và gợi ý xem `rule-impact` cho delta failure; khi không mở được store hoặc chưa có mark, SHALL nói rõ none/n/a. Báo cáo SHALL NOT thay thế semantics lệnh `rule-impact`.

#### Scenario: Có label
- **WHEN** run JSONL/metadata có label `rules-v2` và chạy compare
- **THEN** output chứa `rules-v2`
