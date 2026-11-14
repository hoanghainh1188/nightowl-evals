# failure-report Specification

## Purpose
Cho người dùng thấy AI hay sai kiểu gì, ở module nào, và xu hướng theo tuần, từ dữ liệu NightOwl đã ghi trên máy.

## Requirements

### Requirement: Báo cáo theo loại, module, tuần
`nightowl report` SHALL in ra stdout: tổng số bản ghi lỗi không bị `dismissed`, số lỗi theo từng loại (`logic`, `convention`, `misread-requirement`, `missing-context`, và chưa phân loại), số lỗi theo module, và số lỗi theo tuần ISO, rồi thoát mã 0.

#### Scenario: Có lỗi đã phân loại
- **WHEN** database có 3 lỗi `logic` trong `src/hooks/`, 1 lỗi `convention` trong `src/cli/` và 1 lỗi chưa phân loại
- **THEN** stdout có tổng `5`, `logic` là `3`, `convention` là `1`, chưa phân loại là `1`, module `src/hooks` là `3`, `src/cli` là `1`

#### Scenario: Lỗi bị loại
- **WHEN** một bản ghi lỗi có trạng thái `dismissed`
- **THEN** bản ghi đó không được tính vào bất kỳ con số nào, và stdout cho biết số lỗi bị loại

#### Scenario: Chưa có lỗi nào
- **WHEN** database chưa có bản ghi lỗi nào
- **THEN** stdout nói chưa có lỗi nào được ghi, mã thoát 0

### Requirement: Tỷ lệ code AI bị sửa
Báo cáo SHALL có tỷ lệ code AI bị dev sửa: số lần kiểm tra lúc commit sinh ra lỗi chia cho số lần kiểm tra đã được xử lý sau commit (không tính lần bị thay thế), cả tổng và theo từng tuần. Khi chưa có lần kiểm tra nào, tỷ lệ SHALL hiện là không có dữ liệu thay vì 0%.

#### Scenario: 4 lần kiểm tra, 1 lỗi
- **WHEN** 4 lần kiểm tra đã xử lý sau commit, 1 lần thành lỗi, 3 lần không
- **THEN** stdout có tỷ lệ `25%`

### Requirement: Module là thư mục của file
Module SHALL là `--depth` cấp thư mục đầu tiên của đường dẫn file (mặc định 2). File nằm ở gốc dự án SHALL thuộc module `(root)`. Bản dạng chữ SHALL chỉ in 10 module nhiều lỗi nhất và 8 tuần gần nhất; bản `--json` SHALL có đủ.

#### Scenario: Độ sâu 1
- **WHEN** chạy `nightowl report --depth 1` với lỗi ở `src/hooks/git/a.ts` và `README.md`
- **THEN** module là `src` và `(root)`

### Requirement: Lọc theo ngày và xuất JSON
Với `--since <YYYY-MM-DD>`, báo cáo SHALL chỉ tính bản ghi lỗi và lần kiểm tra tạo từ 00:00 UTC ngày đó. Với `--json`, stdout SHALL là một object JSON hợp lệ chứa cùng các số liệu. Với `--output <path>` (hoặc `-o <path>`), báo cáo SHALL được ghi vào file chỉ định, tự động tạo thư mục cha nếu cần. Giá trị tuỳ chọn không hợp lệ SHALL làm lệnh báo lỗi và thoát mã 1.

#### Scenario: Ngày sai định dạng
- **WHEN** chạy `nightowl report --since 04/11/2026`
- **THEN** stderr báo ngày không hợp lệ, mã thoát 1

#### Scenario: Xuất ra file với --output
- **WHEN** chạy `nightowl report --json --output dist/reports/nightowl.json` trong dự án có dữ liệu
- **THEN** file `dist/reports/nightowl.json` được tạo chứa JSON hợp lệ của báo cáo, và lệnh thoát mã 0

### Requirement: Kiểm soát ngưỡng lỗi CI
Với `--fail-on-rate <0-100>`, nếu tỷ lệ code AI bị sửa (`changedRate.rate * 100`) vượt quá ngưỡng và có dữ liệu kiểm tra (`changedRate.checked > 0`), lệnh SHALL báo lỗi tỷ lệ vượt ngưỡng ra stderr và thoát mã 1; nếu không có dữ liệu kiểm tra hoặc tỷ lệ trong ngưỡng cho phép, lệnh SHALL thoát mã 0.

#### Scenario: Vượt ngưỡng kiểm soát với --fail-on-rate
- **WHEN** tỷ lệ code AI bị sửa là 40% (2 lỗi trên 5 lần kiểm tra) và chạy `nightowl report --fail-on-rate 30`
- **THEN** stderr cảnh báo tỷ lệ lỗi (40%) vượt quá ngưỡng 30%, và lệnh thoát mã 1

#### Scenario: Trong ngưỡng kiểm soát với --fail-on-rate
- **WHEN** tỷ lệ code AI bị sửa là 20% (1 lỗi trên 5 lần kiểm tra) và chạy `nightowl report --fail-on-rate 25`
- **THEN** stdout in báo cáo bình thường và lệnh thoát mã 0

#### Scenario: Chưa có dữ liệu kiểm tra với --fail-on-rate
- **WHEN** chưa có lần kiểm tra nào ghi nhận (`checked == 0`) và chạy `nightowl report --fail-on-rate 20`
- **THEN** stdout in thông báo bình thường và lệnh thoát mã 0 mà không bị fail

### Requirement: Chỉ đọc, không tự khởi tạo
`nightowl report` SHALL mở database chỉ đọc và SHALL NOT thay đổi hay nâng cấp nó; database cũ hơn phiên bản hiện tại SHALL làm lệnh gợi ý `nightowl init` và thoát mã 1. Khi dự án chưa có `.nightowl/nightowl.db`, lệnh SHALL báo cần chạy `nightowl init`, thoát mã 1 và SHALL NOT tạo file hay thư mục nào. Ngoài repo git, lệnh SHALL báo lỗi và thoát mã 1.

#### Scenario: Chưa chạy init
- **WHEN** chạy `nightowl report` trong một repo git chưa có `.nightowl/`
- **THEN** stderr gợi ý `nightowl init`, mã thoát 1, không có `.nightowl/` được tạo

### Requirement: Đếm lỗi theo nguồn
`nightowl report` SHALL in số lỗi theo nguồn (`manual-fix`, `ai-self-fix`), không tính lỗi `dismissed`. Bản `--json` SHALL có `by_source` với đủ hai khoá, kể cả khi bằng 0.

#### Scenario: Có cả hai nguồn
- **WHEN** database có 2 lỗi `manual-fix` và 1 lỗi `ai-self-fix`, rồi chạy `nightowl report --json`
- **THEN** `by_source` là `{"manual-fix": 2, "ai-self-fix": 1}`

### Requirement: Đếm theo trạng thái xem lại
`nightowl report` SHALL in số lỗi `confirmed`, `dismissed` và `flagged`. Bản `--json` SHALL có `by_status` với đủ ba khoá. Tổng số lỗi và các mục khác vẫn không tính lỗi `dismissed`.

#### Scenario: Đã xem một phần
- **WHEN** có 2 lỗi `confirmed`, 1 `dismissed` và 3 `flagged`, rồi chạy `nightowl report --json`
- **THEN** `by_status` là `{"confirmed": 2, "dismissed": 1, "flagged": 3}` và `total` là 5

### Requirement: Báo cáo theo agent
`nightowl report` SHALL in nhóm lỗi theo `agent` (không tính `dismissed`). Bản `--json` SHALL có `by_agent` map agent → số lỗi (kể cả 0 cho agent đã thấy trong cửa sổ nếu design chọn đủ khoá; tối thiểu mọi agent có count > 0).

#### Scenario: Hai agent
- **WHEN** có 3 failure `cursor` và 1 `claude-code` (không dismissed)
- **THEN** báo cáo liệt kê cả hai agent với đúng số đếm

### Requirement: Chỉ số đối đầu theo agent
`nightowl report` SHALL thêm chỉ số đối đầu trong cửa sổ `--since`: với mỗi agent, tỷ lệ hoặc tỷ số “AI edits bị dev sửa / edits đã kiểm tra tại commit” (cùng ý với % hiện có, nhưng tách theo agent). Bản `--json` SHALL có cấu trúc tương ứng (ví dụ `head_to_head`).

#### Scenario: Cursor xấu hơn Claude
- **WHEN** trong tuần, Claude Code 10% edits đổi và Cursor 25% edits đổi
- **THEN** stdout/JSON phản ánh hai tỷ lệ tách biệt theo agent

### Requirement: Lọc theo agent
`nightowl report` SHALL chấp nhận `--agent <id>` (lặp được) để chỉ tính failure/metric của agent đó.

#### Scenario: Lọc cursor
- **WHEN** `nightowl report --agent cursor`
- **THEN** không tính failure `claude-code` vào tổng và các nhóm

### Requirement: Báo cáo tín hiệu CI và PR
`nightowl report` SHALL gồm số đếm sự kiện/tín hiệu CI fail và PR review trong cửa sổ `--since` (không tính dismissed failures cho phần failure hiện có). Bản `--json` SHALL có trường đã document (ví dụ `ci_signals` / `pr_signals` hoặc tương đương) với số nguyên ≥ 0.

#### Scenario: Có CI fail trong cửa sổ
- **WHEN** store có ≥1 sự kiện CI trong `--since` và chạy `nightowl report --json`
- **THEN** JSON phản ánh số đếm CI > 0

#### Scenario: Không có tín hiệu
- **WHEN** không có sự kiện CI/PR trong cửa sổ
- **THEN** các trường đếm tương ứng bằng 0; lệnh vẫn thoát 0

### Requirement: Báo cáo ước lượng nhiễu
`nightowl report` (text và `--json`) SHALL gồm ước lượng nhiễu trong cửa sổ lọc hiện tại: tỷ lệ review-noise `dismissed/(dismissed+confirmed)` khi mẫu đủ, cộng số lượng failure auto-noise (dismissed bởi safe auto-noise / reason auto) nếu có. JSON SHALL có khoá ổn định (ví dụ `noise`) với các field đã document. Khi thiếu mẫu review, tỷ lệ SHALL là `null` / n/a chứ không 0 giả.

#### Scenario: JSON có noise
- **WHEN** chạy `nightowl report --json` với vài failure confirmed và dismissed
- **THEN** JSON có object `noise` gồm tỷ lệ hoặc null và count auto-noise ≥ 0

### Requirement: Báo cáo theo cluster
`nightowl report` (text và `--json`) SHALL gồm tóm tắt cluster trong cửa sổ lọc hiện tại: ít nhất top N cluster theo count (N đã document, ví dụ 10) với key (hoặc nhãn an toàn), count, và có thể sample module/category. JSON SHALL có khoá ổn định (ví dụ `by_cluster` hoặc `clusters`). Dismissed SHALL không đếm vào cluster total giống quy tắc total hiện có trừ khi document khác. SHALL NOT lộ tên/email developer.

#### Scenario: JSON có clusters
- **WHEN** cửa sổ có ≥2 failure cùng cluster và chạy `nightowl report --json`
- **THEN** JSON có danh sách/object cluster với count ≥ 2 cho nhóm đó

### Requirement: Báo cáo tín hiệu revert
`nightowl report` (text và `--json`) SHALL gồm số đếm sự kiện `revert` trong cửa sổ `--since` cùng nhóm Signals (cạnh ci-fail / pr-review), không trộn vào `total` failures. JSON SHALL có field ổn định (ví dụ `signals.revert` hoặc tương đương) ≥ 0.

#### Scenario: Có revert trong cửa sổ
- **WHEN** store có ≥1 sự kiện revert trong `--since` và chạy `nightowl report --json`
- **THEN** JSON phản ánh đếm revert > 0

#### Scenario: Không có revert
- **WHEN** không có sự kiện revert trong cửa sổ
- **THEN** field đếm tương ứng = 0; lệnh vẫn thoát 0

### Requirement: Module tôn trọng workspace khi có
Khi discovery tìm thấy ≥1 workspace/package root, nhãn module trong `nightowl report` (text và `--json`) SHALL dùng nhãn workspace đã document cho file thuộc package đó (ví dụ path root hoặc package `name`). File ngoài mọi package SHALL vẫn dùng quy tắc `--depth` hiện có. Khi không có workspace, semantics `--depth` SHALL không đổi.

#### Scenario: Monorepo package label
- **WHEN** failure ở `packages/ui/src/a.ts`, workspace `packages/ui` được phát hiện, chạy `nightowl report`
- **THEN** `byModule` (hoặc tương đương) có nhãn workspace đã document cho failure đó, không chỉ `packages/ui` cắt depth nông sai nghĩa nếu design chọn name/`packages/ui` ổn định

### Requirement: Lọc --workspace trên report
`nightowl report` SHALL chấp nhận `--workspace <name>` (repeatable nếu design chọn). Khi có, chỉ failure (và metrics liên quan trong cửa sổ) thuộc workspace khớp SHALL được tính. Tên không hợp lệ/không khớp SHALL lỗi rõ hoặc cho kết quả rỗng theo design đã document; thoát ≠ 0 nếu chọn lỗi.

#### Scenario: Filter workspace
- **WHEN** chạy `nightowl report --workspace packages/ui` (hoặc name đã document) với failure trong và ngoài package
- **THEN** tổng/module chỉ phản ánh failure trong workspace đó

### Requirement: Module path chuẩn hóa separator
Trước khi tính nhãn module theo `--depth` hoặc workspace, `nightowl report` (và mọi caller dùng cùng quy tắc module đã document) SHALL chuẩn hóa separator đường dẫn relative trong repo: `\` và `/` tương đương. Kết quả nhãn module SHALL dùng `/` (hoặc nhãn workspace) và SHALL NOT phụ thuộc OS separator của path đầu vào.

#### Scenario: Path kiểu Windows vẫn ra cùng module
- **WHEN** failure có `file_path` dạng `src\\hooks\\a.ts` (hoặc tương đương) và depth 2, không thuộc workspace package
- **THEN** nhãn module bằng `src/hooks` (cùng kết quả như `src/hooks/a.ts`)

### Requirement: changedRate tôn trọng --workspace
Khi `nightowl report` chạy với `--workspace` và có dữ liệu check gắn path file (edit/check có `file_path`), `changedRate` (và head-to-head dựa trên cùng nguồn check) SHALL chỉ đếm checks thuộc workspace đã chọn, cùng quy tắc khớp path với filter failure. Khi không có `--workspace`, semantics `changedRate` SHALL không đổi.

#### Scenario: Gate theo một package
- **WHEN** repo monorepo có checks/failures trong `packages/ui` và package khác, chạy `nightowl report --workspace packages/ui --fail-on-rate <N>`
- **THEN** `changedRate.checked` / failures dùng cho rate chỉ phản ánh `packages/ui` (không cộng check ngoài workspace)

#### Scenario: Không --workspace giữ full-window
- **WHEN** chạy `nightowl report` không có `--workspace`
- **THEN** `changedRate` vẫn trên toàn cửa sổ `--since` như hiện tại

### Requirement: Cảnh báo khi gate + workspace lệch mẫu số
Khi vừa có `--workspace` vừa có `--fail-on-rate`, nếu NightOwl không thể scope đủ checks theo path (vd. check không có `file_path`) hoặc mẫu số rõ ràng không cùng tập với failures đã lọc, lệnh SHALL cảnh báo trên stderr (thoát theo ngưỡng rate như cũ; cảnh báo không đổi mã thoát trừ khi design chọn `--strict` — mặc định chỉ warn).

#### Scenario: Check thiếu path khi đang filter workspace
- **WHEN** `--workspace` + `--fail-on-rate` và tồn tại check trong cửa sổ không gắn `file_path` nên không vào mẫu số workspace
- **THEN** stderr có cảnh báo về scope/mẫu số; hành vi fail-on-rate vẫn dựa trên `changedRate` đã document

### Requirement: Signals document khi có --workspace
Với `--workspace`, phần signals (ci-fail / pr-review / revert) SHALL được document là **full-window theo `--since`** trừ khi một signal có path và design chọn lọc (mặc định: không lọc signals). Report text và/hoặc `--json` MAY gắn ghi chú scope; help/README SHALL nêu rõ.

#### Scenario: README/help nêu signals full-window
- **WHEN** đọc README hoặc `nightowl report --help` sau change
- **THEN** có câu nói signals không bị `--workspace` thu hẹp (trừ khi ghi chú khác đã document)

### Requirement: Report gồm metric repeat
`nightowl report` SHALL tính metric repeat theo capability `repeat-outcomes` trên cùng cửa sổ `--since` / agent / workspace (khi có) như failures được báo cáo, và SHALL in tóm tắt repeat trên bản text. Bản `--json` SHALL có object `repeat` với các khoá đã document (ít nhất `repeat_count`, `new_count`, `repeat_rate`, và mốc baseline/window khi áp dụng). Field hiện có (`total`, `noise`, `clusters`, `changed_rate`, …) SHALL giữ semantics. Lệnh vẫn chỉ đọc store.

#### Scenario: JSON có object repeat
- **WHEN** chạy `nightowl report --json` trên store có failure đủ fingerprint trong window và baseline
- **THEN** stdout JSON có `repeat` với `repeat_count`, `new_count`, và `repeat_rate` (số hoặc null)

#### Scenario: Text nêu repeat
- **WHEN** chạy `nightowl report` (text) khi có ít nhất một key trong window
- **THEN** stdout có dòng/section tóm tắt repeat vs new (hoặc rate) theo ngôn ngữ đã document

#### Scenario: Không đổi changed_rate
- **WHEN** so sánh `changed_rate` trước/sau change trên cùng fixture
- **THEN** công thức và giá trị `changed_rate` không đổi chỉ vì thêm metric repeat
