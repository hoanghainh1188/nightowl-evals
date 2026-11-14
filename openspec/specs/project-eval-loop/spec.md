# project-eval-loop Specification

## Purpose

Định nghĩa vòng local failure → suite JSONL → eval/compare → tóm tắt digest/dashboard và next-step hints, để team so model/rules có số hàng tuần mà không sync cloud.

## Requirements

### Requirement: Vòng eval project đã document
NightOwl SHALL document một vòng local: failure đã review (`confirmed`) hoặc nguồn cluster/export đã chọn → tạo suite (`export` và/hoặc `suggest-regressions`) → `eval` với `--label` → `eval-compare` (khi có baseline) → xem `digest` / `dashboard`. Vòng SHALL NOT yêu cầu mạng ngoài LLM opt-in của `eval` / `eval --yes`.

#### Scenario: README hoặc help nêu vòng
- **WHEN** đọc README mục eval/export hoặc `--help` lệnh liên quan
- **THEN** có mô tả thứ tự bước local (export/suggest → eval --label → compare/digest/dashboard)

### Requirement: Next-step hints không mạng
Sau khi `export` ghi suite thành công và sau khi `suggest-regressions` ghi artifact thành công, NightOwl SHALL in stderr (hoặc stdout đã document) gợi ý bước tiếp theo gồm lệnh `eval` (nhắc `--label`) và tuỳ chọn `eval-compare` / `digest` / `dashboard`. Hints SHALL NOT gọi mạng và SHALL NOT chứa secret/path tuyệt đối home.

#### Scenario: Export xong có Next
- **WHEN** `nightowl export` ghi file JSONL thành công
- **THEN** stderr chứa dòng “Next” (hoặc tương đương) đề cập `nightowl eval` và `--label`

#### Scenario: Suggest-regressions ghi xong có Next
- **WHEN** `nightowl suggest-regressions` ghi fixture/stub thành công với cờ output đã document
- **THEN** stderr chứa gợi ý bước eval hoặc gắn suite vào vòng đã document

### Requirement: Digest/dashboard surface eval-loop
`digest` và `dashboard` SHALL gồm một dòng hoặc section eval-loop dùng wording ổn định đã document: khi có ít nhất một run trong `.nightowl/runs/` (hoặc path runs đã document), nêu label (nếu có) và tóm tắt so với baseline gần nhất nếu resolve được, hoặc tóm tắt run mới nhất; khi không có run → none/n/a. Semantics SHALL khớp giữa digest và dashboard. SHALL NOT lộ tên/email developer; SHALL NOT gọi mạng.

#### Scenario: Có run thì hiện label
- **WHEN** `.nightowl/runs/` có run JSONL với metadata label `rules-v2` và chạy `digest`
- **THEN** output chứa `rules-v2` (hoặc label đó) trong phần eval-loop

#### Scenario: Chưa có run
- **WHEN** chưa có run eval và chạy `dashboard`
- **THEN** HTML nêu eval-loop none/n/a; thoát 0
