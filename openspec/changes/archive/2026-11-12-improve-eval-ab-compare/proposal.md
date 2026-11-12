# Proposal

## Why

`nightowl eval` đã chạy nhiều model và in bảng ASCII + danh sách case bất đồng + JSONL trong `.nightowl/runs/`, nhưng báo cáo đối đầu vẫn khó đọc cho người không quen CLI, và **không** có delta rõ ràng so với một run baseline hay gắn ngữ cảnh rule vừa áp dụng. Ideation #38 cần bảng so sánh A/B local (Markdown/HTML) để quyết định model / cải thiện rules bằng số liệu trên chính codebase.

## What Changes

- Thêm **báo cáo so sánh eval A/B local** (Markdown mặc định; HTML self-contained tùy chọn): bảng theo model (scored / passed / mean score / failed calls; cột tests nếu có), delta so với baseline khi cung cấp, và danh sách case bất đồng pass/fail.
- Cho phép **so sánh offline** từ file JSONL trong `.nightowl/runs/` (không gọi model lại): lệnh tường minh (ví dụ `eval-compare`) và/hoặc cờ trên `eval` để ghi cùng báo cáo sau khi chạy `--yes`.
- Hỗ trợ **nhãn run** (ví dụ `--label`) để gắn thí nghiệm prompt/rules mà không bắt buộc ma trận factorial đầy đủ trong MVP; báo cáo nêu label (và label baseline nếu có).
- **Gắn rule-impact window** nhẹ: khi store có bản rule-applied, báo cáo MAY/SHOULD nêu nhãn + `applied_at` (và gợi ý `rule-impact` cho delta failure) — không thay thế lệnh `rule-impact`, không đổi CI gate.
- Không **BREAKING** stdout bảng ASCII hiện có trừ khi cờ format/report thay đổi đầu ra đã document (giữ bảng text khi không chọn Markdown/HTML file).
- Không gửi mạng, không telemetry, không LLM mới cho bước compare. Không schema DB mới bắt buộc (metadata run có thể nằm trong JSONL/sidecar local). README + tick #38 khi archive.

### Out of scope

- SaaS / dashboard team hosted / sync multi-repo / billing.
- Gọi model hoặc re-score trong lệnh compare.
- Ma trận đầy đủ prompt × rules × model trong một lần chạy (MVP: model + label run; prompt/rules là nhãn thí nghiệm).
- Đổi công thức chấm điểm textual hiện có.
- Lộ tên/email developer; dump toàn bộ `output` code vào HTML công khai mặc định (chỉ id/model/metrics; chi tiết output giữ trong JSONL runs).

## Capabilities

### New Capabilities

- `eval-ab-compare`: So sánh kết quả eval local (run vs baseline), bảng model + delta + case bất đồng, xuất Markdown/HTML; gắn nhãn run và chú thích rule-impact khi có.

### Modified Capabilities

- `eval-run`: Sau chạy (và dry-run mô tả), hỗ trợ nhãn run / xuất báo cáo A/B theo cờ đã document; vẫn ghi JSONL runs như hiện có.
- `cli`: Đăng ký help cho lệnh/cờ compare.
- `shell-completion`: Catalog subcommand/flag mới.

## Impact

- Code: module so sánh/format báo cáo (tái dùng escape/HTML style digest nếu hợp lý); wiring `eval` và lệnh compare; đọc JSONL `.nightowl/runs/`; đọc rule-applied chỉ-đọc khi annotate.
- Tests: parse run file, delta vs baseline, format MD/HTML, CLI flags.
- Không dependency runtime mới; macOS / Linux / Windows.
