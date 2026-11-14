# cli Specification

## Purpose
Lệnh `nightowl` là điểm vào duy nhất của NightOwl Evals: chuyển tới lệnh con, in hướng dẫn và phiên bản, và trả mã thoát rõ ràng để người dùng, hook và script dựa vào được.

## Requirements

### Requirement: Cài đặt lệnh nightowl
Package `@hoanghainh/nightowl-evals` SHALL cung cấp một file thực thi tên `nightowl` khi được cài qua npm, chạy được trên Node.js 22.13 trở lên.

#### Scenario: Gọi bin sau khi cài
- **WHEN** người dùng cài package và chạy `nightowl --version`
- **THEN** lệnh chạy được và thoát mã 0

### Requirement: In phiên bản
`nightowl --version` SHALL in đúng chuỗi phiên bản trong `package.json` ra stdout, theo sau là một ký tự xuống dòng, và thoát mã 0.

#### Scenario: Cờ --version
- **WHEN** người dùng chạy `nightowl --version`
- **THEN** stdout chỉ chứa phiên bản của package (ví dụ `0.1.0`) và mã thoát là 0

### Requirement: In hướng dẫn
`nightowl --help`, `nightowl help`, và `nightowl` khi không có tham số, SHALL in hướng dẫn sử dụng ra stdout rồi thoát mã 0. Hướng dẫn SHALL liệt kê mọi lệnh con đã đăng ký kèm mô tả một dòng, và SHALL có dòng gợi ý `nightowl <command> --help`.

#### Scenario: Cờ --help
- **WHEN** người dùng chạy `nightowl --help`
- **THEN** stdout chứa `init`, `log`, `report`, `export`, `doctor`, `prune` và `nightowl <command> --help`, mã thoát là 0

#### Scenario: Không có tham số
- **WHEN** người dùng chạy `nightowl` không kèm tham số
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

#### Scenario: Lệnh help không kèm tên lệnh
- **WHEN** người dùng chạy `nightowl help`
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

#### Scenario: help kèm cờ trợ giúp
- **WHEN** người dùng chạy `nightowl help --help` hoặc `nightowl help help`
- **THEN** stdout giống hệt khi chạy `nightowl --help` và mã thoát là 0

### Requirement: Lệnh con không tồn tại
Khi lệnh con không có trong danh sách đăng ký, `nightowl` SHALL in ra stderr một thông báo nêu tên lệnh sai và gợi ý `nightowl --help`, không in gì ra stdout, và thoát mã 1.

#### Scenario: Gõ sai tên lệnh
- **WHEN** người dùng chạy `nightowl reprot`
- **THEN** stderr chứa `reprot` và `--help`, stdout rỗng, mã thoát là 1

### Requirement: Lệnh log không bao giờ chặn hook
`nightowl log` SHALL đọc hết stdin rồi thoát mã 0, không in gì ra stdout hay stderr, kể cả khi stdin rỗng, không phải JSON, hoặc bị lỗi khi đọc.

#### Scenario: stdin là JSON hợp lệ
- **WHEN** một JSON payload được pipe vào `nightowl log`
- **THEN** lệnh thoát mã 0 và stdout, stderr đều rỗng

#### Scenario: stdin không hợp lệ
- **WHEN** chuỗi `not json` được pipe vào `nightowl log`
- **THEN** lệnh thoát mã 0 và stdout, stderr đều rỗng

#### Scenario: Không có stdin
- **WHEN** `nightowl log` chạy với stdin đã đóng và rỗng
- **THEN** lệnh thoát mã 0 trong vòng 1 giây

#### Scenario: stdin không bao giờ đóng
- **WHEN** `nightowl log` chạy với stdin là một pipe còn mở nhưng không gửi EOF
- **THEN** lệnh bỏ phần chưa đọc, thoát mã 0 trong vòng 1 giây, và stdout, stderr đều rỗng

### Requirement: Không crash khi pipe đầu ra bị đóng
Khi stdout hoặc stderr bị đóng sớm (ví dụ `nightowl --help | head -c 0`), `nightowl` SHALL NOT in stack trace và SHALL giữ mã thoát của lệnh.

#### Scenario: Người đọc đóng stdout
- **WHEN** chạy `nightowl --help` và stdout bị đóng trước khi lệnh ghi xong
- **THEN** lệnh thoát mã 0 và stderr rỗng

### Requirement: Không truy cập mạng
Lệnh `nightowl` và mọi lệnh con SHALL NOT mở kết nối mạng hay gửi dữ liệu ra khỏi máy.

#### Scenario: Chạy khi không có mạng
- **WHEN** chạy `nightowl --help`, `nightowl --version` và từng lệnh con trên máy không có mạng
- **THEN** mọi lệnh cho kết quả và mã thoát giống như khi có mạng

### Requirement: Trợ giúp cho từng lệnh
Với mọi lệnh con đã đăng ký, khi `-h` hoặc `--help` có ở bất kỳ vị trí nào trong các tham số sau tên lệnh (kể cả ở chỗ giá trị của tuỳ chọn khác, hoặc sau `--`), `nightowl` SHALL in trợ giúp của lệnh đó ra stdout rồi thoát mã 0, và SHALL NOT chạy lệnh. Không file, database hay hook nào bị tạo hoặc sửa, và không dữ liệu nào được gửi đi. Trợ giúp SHALL gồm cách gọi, mô tả ngắn, và mọi tuỳ chọn lệnh nhận được kèm giá trị mặc định nếu có.

#### Scenario: init --help không cài gì
- **WHEN** người dùng chạy `nightowl init --help` trong một repo git chưa cài NightOwl
- **THEN** stdout chứa `Usage: nightowl init`, mã thoát là 0, và không có `.claude/settings.json`, `.nightowl/` hay git hook nào được tạo

#### Scenario: Tuỳ chọn của lệnh hiện trong trợ giúp
- **WHEN** người dùng chạy `nightowl eval --help`
- **THEN** stdout chứa `--yes`, `--input`, `--model`, `--limit` cùng giá trị mặc định, mã thoát là 0, và `claude` không được gọi

#### Scenario: Cờ ngắn -h
- **WHEN** người dùng chạy `nightowl report -h`
- **THEN** stdout giống hệt khi chạy `nightowl report --help` và mã thoát là 0

#### Scenario: --help đứng sau tuỳ chọn khác
- **WHEN** người dùng chạy `nightowl export --since 2026-01-01 --help`
- **THEN** stdout là trợ giúp của `export`, mã thoát là 0, và không file export nào được ghi

#### Scenario: Trợ giúp của lệnh hook
- **WHEN** người dùng chạy `nightowl log --help`
- **THEN** stdout là trợ giúp của `log`, nêu rằng lệnh do hook gọi, mã thoát là 0, và lệnh không đọc stdin

### Requirement: Lệnh help với tên lệnh
`nightowl help <lệnh>` SHALL cho cùng stdout và mã thoát như `nightowl <lệnh> --help`. Khi tên lệnh không tồn tại, `nightowl help` SHALL xử lý giống như gõ sai tên lệnh.

#### Scenario: help kèm tên lệnh
- **WHEN** người dùng chạy `nightowl help classify`
- **THEN** stdout giống hệt khi chạy `nightowl classify --help` và mã thoát là 0

#### Scenario: help kèm tên lệnh sai
- **WHEN** người dùng chạy `nightowl help reprot`
- **THEN** stderr chứa `reprot` và `--help`, stdout rỗng, mã thoát là 1

### Requirement: Lệnh không có tuỳ chọn từ chối tham số lạ
`nightowl init` chỉ nhận tuỳ chọn `--shared`. `nightowl failures` và `nightowl uninstall` không nhận tuỳ chọn hay tham số nào. Cả ba đều nhận thêm `-h`/`--help`. Khi có tham số khác, lệnh SHALL in ra stderr thông báo nêu tham số sai và gợi ý `nightowl <lệnh> --help`, thoát mã 1, và SHALL NOT tạo, sửa hay xoá file nào.

#### Scenario: init với tuỳ chọn gõ sai
- **WHEN** người dùng chạy `nightowl init --force` trong một repo git chưa cài NightOwl
- **THEN** stderr chứa `--force` và `--help`, mã thoát là 1, và không có `.claude/`, `.nightowl/` hay git hook nào được tạo

#### Scenario: failures với tham số thừa
- **WHEN** người dùng chạy `nightowl failures all`
- **THEN** stderr chứa `all`, mã thoát là 1, và `.nightowl/` không bị tạo

#### Scenario: uninstall với tham số thừa
- **WHEN** người dùng chạy `nightowl uninstall --all` trong repo đã cài NightOwl
- **THEN** stderr chứa `--all`, mã thoát là 1, và mọi hook NightOwl vẫn còn nguyên

### Requirement: Lệnh hook bỏ qua tham số lạ
`nightowl log`, `nightowl precommit` và `nightowl postcommit` SHALL bỏ qua mọi tham số khác `-h`/`--help`, và SHALL giữ hành vi thoát mã 0 mà không in gì.

#### Scenario: precommit với tham số lạ
- **WHEN** git hook chạy `nightowl precommit --unknown`
- **THEN** lệnh thoát mã 0 và stdout, stderr đều rỗng

### Requirement: Đăng ký lệnh uninstall
`nightowl` SHALL đăng ký lệnh `uninstall` với mô tả một dòng, hiện trong hướng dẫn chung, và có trợ giúp riêng qua `nightowl uninstall --help`.

#### Scenario: uninstall trong hướng dẫn chung
- **WHEN** người dùng chạy `nightowl --help`
- **THEN** stdout có một dòng bắt đầu bằng `uninstall`

### Requirement: Đăng ký lệnh review
`nightowl` SHALL đăng ký lệnh `review` với mô tả một dòng, hiện trong hướng dẫn chung. `nightowl review --help` SHALL liệt kê các lệnh con `list`, `show`, `confirm`, `dismiss`, `reset` cùng tuỳ chọn của `list`. Lệnh con lạ hoặc tuỳ chọn lạ SHALL được báo ra stderr với gợi ý `nightowl review --help`, và thoát mã 1.

#### Scenario: Lệnh con gõ sai
- **WHEN** chạy `nightowl review dismis 12`
- **THEN** stderr chứa `dismis` và `--help`, không lỗi nào đổi trạng thái, mã thoát là 1

### Requirement: help nêu đa agent
Help của `init`, `log`, `report`, `review`, `uninstall` SHALL mô tả ngắn hỗ trợ đa agent và các flag `--agents` / `--agent` khi có. `init --help` SHALL gợi ý rằng không phải mọi agent đều có hook native (xem README maturity).

#### Scenario: init --help
- **WHEN** chạy `nightowl init --help`
- **THEN** stdout có `--agents` và liệt kê hoặc trỏ tới danh sách agent hỗ trợ / maturity

### Requirement: doctor help nêu kiểm tra đa agent
`nightowl doctor --help` SHALL nêu rằng lệnh kiểm tra cấu hình ingest đa agent (theo mức hỗ trợ) ngoài Claude Code và Git hooks.

#### Scenario: doctor --help
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập kiểm tra agent hooks hoặc maturity đa agent

### Requirement: Đăng ký lệnh suggest-rules
`nightowl` SHALL đăng ký lệnh con `suggest-rules` với mô tả một dòng trong help chung. `nightowl suggest-rules --help` SHALL mô tả bộ lọc (`--since`, `--category`, `--agent`, trạng thái), chế độ LLM opt-in, `--output` (file đề xuất độc lập), và `--write` (chèn/cập nhật khối marker trong file rule dự án). Help SHALL nêu rõ mặc định không gọi LLM và không sửa file rule trừ khi có `--output` hoặc `--write`.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `suggest-rules`

#### Scenario: suggest-rules --help
- **WHEN** chạy `nightowl suggest-rules --help`
- **THEN** stdout nêu mặc định không gọi LLM; phân biệt `--output` vs `--write`; và không tự sửa file rule khi không có các cờ đó

### Requirement: Đăng ký lệnh suggest-regressions
`nightowl` SHALL đăng ký lệnh con `suggest-regressions` với mô tả một dòng trong help chung. `nightowl suggest-regressions --help` SHALL mô tả bộ lọc, chế độ ghi file, và mặc định không gọi LLM / không tự sửa suite dự án.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `suggest-regressions`

#### Scenario: suggest-regressions --help
- **WHEN** chạy `nightowl suggest-regressions --help`
- **THEN** stdout nêu rõ mặc định không gọi LLM và không tự ghi file test trừ khi có tuỳ chọn ghi tường minh

### Requirement: Help review nêu chế độ interactive
`nightowl review --help` SHALL nêu `-i` / `--interactive` và tóm tắt phím tắt chính (điều hướng, xem diff, confirm/dismiss/reset, thoát).

#### Scenario: review --help có -i
- **WHEN** chạy `nightowl review --help`
- **THEN** stdout có `-i` hoặc `--interactive` và nhắc các phím `c` / `d` / `q` (hoặc tương đương đã document)

### Requirement: Đăng ký lệnh completion
Package SHALL đăng ký lệnh con `completion`. `nightowl --help` SHALL liệt kê `completion`. `nightowl completion --help` SHALL in trợ giúp (cách gọi `bash|zsh|fish`) rồi thoát mã 0 mà không in script completion đầy đủ như khi chọn shell.

#### Scenario: Help tổng có completion
- **WHEN** chạy `nightowl --help`
- **THEN** stdout chứa `completion`

#### Scenario: completion --help
- **WHEN** chạy `nightowl completion --help`
- **THEN** stdout là trợ giúp của `completion`, mã thoát 0, và không phải toàn bộ script Bash/Zsh/Fish dài (hoặc rõ là help chứ không phải eval script)

### Requirement: Đăng ký lệnh ingest-ci và ingest-pr
`nightowl` SHALL đăng ký lệnh con ingest CI và ingest PR (tên chính xác theo design, ví dụ `ingest-ci` / `ingest-pr`) với mô tả một dòng trong help chung. `--help` từng lệnh SHALL mô tả input file, giới hạn không bịa `ai_content`, và (với PR) điều kiện opt-in GitHub API.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có tên cả hai lệnh ingest

#### Scenario: ingest-ci --help
- **WHEN** chạy `nightowl ingest-ci --help`
- **THEN** stdout nêu `--file` / đường dẫn JUnit hoặc summary và mặc định không mạng

### Requirement: Đăng ký lệnh rule-impact
`nightowl` SHALL đăng ký lệnh con đo impact rule (tên chính xác theo design, ví dụ `rule-impact`) với mô tả một dòng trong help chung. `--help` của lệnh (và subcommand mark/show nếu có) SHALL mô tả mark baseline, so sánh cửa sổ, và mặc định offline / không LLM.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có tên lệnh rule-impact đã đăng ký

#### Scenario: rule-impact --help
- **WHEN** chạy `nightowl rule-impact --help`
- **THEN** stdout nêu mark / show (hoặc tương đương) và không mạng mặc định

### Requirement: Đăng ký lệnh customer-report
`nightowl` SHALL đăng ký lệnh con `customer-report` với mô tả một dòng trong help chung. `--help` của lệnh SHALL mô tả xuất báo cáo chất lượng AI cho khách (Markdown/HTML, mẫu VI–JA), các flag `--lang`, `--format`, `--since`, `--depth`, `--agent`, `--output`, và SHALL nêu rõ không gọi mạng / không lộ tên developer.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `customer-report`

#### Scenario: customer-report --help
- **WHEN** chạy `nightowl customer-report --help`
- **THEN** stdout nêu `--lang`, `--format`, và audience báo cáo khách; mã thoát 0

### Requirement: Đăng ký lệnh dashboard
`nightowl` SHALL đăng ký lệnh con `dashboard` với mô tả một dòng trong help chung. `--help` của lệnh SHALL mô tả dashboard HTML local-only cho team nội bộ, các flag `--since`, `--depth`, `--agent`, `--output`, `--open`, và SHALL nêu rõ không gọi mạng / không lộ tên developer / không phải SaaS dashboard.

#### Scenario: help liệt kê lệnh
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `dashboard`

#### Scenario: dashboard --help
- **WHEN** chạy `nightowl dashboard --help`
- **THEN** stdout nêu `--output`, `--open`, và local-only; mã thoát 0

### Requirement: Đăng ký lệnh ingest-revert
CLI `nightowl` SHALL đăng ký lệnh `ingest-revert` (hoặc tên đã document trong help gốc) với `--help` riêng. Lệnh SHALL xuất hiện trong danh sách help cấp cao khi NightOwl liệt kê subcommands.

#### Scenario: help liệt kê ingest-revert
- **WHEN** chạy `nightowl --help` hoặc tương đương liệt kê lệnh
- **THEN** stdout gồm tên lệnh ingest-revert (hoặc alias đã document)

### Requirement: Đăng ký lệnh digest
`nightowl` SHALL đăng ký lệnh con `digest` với mô tả một dòng trong help chung. `--help` của lệnh SHALL mô tả digest local cho standup/weekly, cửa sổ thời gian, định dạng Markdown/HTML, và SHALL nêu rõ không gửi email/Slack, không gọi mạng, không lộ tên developer.

#### Scenario: help liệt kê digest
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có `digest`

#### Scenario: digest --help
- **WHEN** chạy `nightowl digest --help`
- **THEN** stdout nêu `--since` (hoặc tương đương), `--format`, và local-only / không gửi email; mã thoát 0

### Requirement: Help nêu cờ privacy export
`--help` của `export` SHALL mô tả các cờ privacy đã document (`--redact-paths`, `--privacy-dry-run` hoặc tương đương) và ý nghĩa không lộ secret plaintext trên dry-run. Help `customer-report` / `dashboard` / `digest` SHALL nêu cờ coarsen path nếu lệnh hỗ trợ.

#### Scenario: export --help có privacy
- **WHEN** chạy `nightowl export --help`
- **THEN** stdout chứa ít nhất một trong các cờ privacy đã document

### Requirement: Đăng ký lệnh eval-compare
`nightowl` SHALL đăng ký lệnh con so sánh eval A/B đã document (ví dụ `eval-compare`) với mô tả một dòng trong help chung. `--help` của lệnh SHALL mô tả input/baseline, format Markdown/HTML, và nêu rõ không gọi mạng/LLM.

#### Scenario: help liệt kê eval-compare
- **WHEN** chạy `nightowl --help`
- **THEN** stdout có tên lệnh compare đã document

#### Scenario: eval-compare --help
- **WHEN** chạy `nightowl eval-compare --help` (hoặc tên đã document)
- **THEN** stdout nêu `--input` / `--baseline` / `--format` (hoặc tương đương); mã thoát 0

### Requirement: Help eval nêu label và report
`--help` của `nightowl eval` SHALL mô tả cờ `--label` và cờ xuất báo cáo A/B đã document (nếu lệnh hỗ trợ trên `eval`).

#### Scenario: eval --help có label
- **WHEN** chạy `nightowl eval --help`
- **THEN** stdout chứa `--label` (hoặc tên tương đương đã document)

### Requirement: Help nêu --workspace và module workspace
`--help` của `report` / `customer-report` / `dashboard` / `digest` SHALL mô tả `--workspace` (khi lệnh hỗ trợ) và nêu rằng module có thể lấy theo package/workspace root khi monorepo được phát hiện, còn không thì giữ `--depth`.

#### Scenario: report --help có workspace
- **WHEN** chạy `nightowl report --help`
- **THEN** stdout chứa `--workspace`

### Requirement: doctor help nêu workspace và readiness team
`nightowl doctor --help` SHALL nêu rằng lệnh còn kiểm tra workspace/monorepo (khi có config), authenticity cấu hình hook/agent, và tóm tắt sẵn sàng report (failures + signals), ngoài các kiểm tra môi trường/hook đã có.

#### Scenario: doctor --help có workspace/readiness
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập workspace hoặc monorepo và readiness/report hoặc signals

### Requirement: Help nêu vòng phản hồi rule local
`--help` của `suggest-rules` và `rule-impact` SHALL nêu ngắn vòng phản hồi local: đề xuất rule → (opt-in `--write`/`--output`) → `rule-impact mark --label` → xem impact / digest / dashboard. Help SHALL nhắc mặc định không ghi file rule và không gọi LLM trừ opt-in đã có. `--help` của `digest` và/hoặc `dashboard` MAY nhắc dòng rule-impact khi có mark.

#### Scenario: suggest-rules --help có vòng phản hồi
- **WHEN** chạy `nightowl suggest-rules --help`
- **THEN** stdout đề cập `rule-impact` mark hoặc bước tiếp sau khi ghi đề xuất

#### Scenario: rule-impact --help có vòng phản hồi
- **WHEN** chạy `nightowl rule-impact --help`
- **THEN** stdout đề cập suggest-rules và/hoặc digest/dashboard như bề mặt xem tóm tắt sau mark

### Requirement: Document Windows path và permission limits
Tài liệu người dùng (README và/hoặc `--help` của `init` / `doctor` khi phù hợp) SHALL nêu ngắn rằng trên Windows: (1) path `\` được chuẩn hóa tương đương `/` cho module/workspace; (2) quyền thư mục `.nightowl/` là best-effort trên NTFS; (3) git hook không phụ thuộc execute-bit POSIX. SHALL NOT yêu cầu WSL.

#### Scenario: README nêu Windows DX
- **WHEN** đọc README mục setup/doctor hoặc tương đương sau change
- **THEN** có đoạn mô tả giới hạn/hành vi Windows path hoặc permission hoặc hook như trên

### Requirement: Help nêu kiểm tra adapter đa agent sâu hơn
`nightowl doctor --help` và/hoặc `init --help` SHALL nêu ngắn rằng kiểm tra/cài đặt đa agent gồm shape cấu hình best-effort (không chỉ tồn tại file) và trỏ README cho giới hạn maturity từng agent. SHALL NOT hứa hook native cho agent `manual`.

#### Scenario: doctor --help đề cập shape/maturity
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập kiểm tra cấu hình agent / maturity / authenticity hoặc shape (ngôn ngữ đã document)

### Requirement: report help nêu scope metrics với --workspace
`nightowl report --help` SHALL nêu rằng với `--workspace`, failures và `changedRate` (checks có path) bị thu hẹp theo package; signals mặc định vẫn full `--since`; và có thể cảnh báo khi `--fail-on-rate` kết hợp filter mà mẫu số không đủ scoped.

#### Scenario: report --help có scope metrics
- **WHEN** chạy `nightowl report --help`
- **THEN** stdout đề cập `--workspace` cùng changedRate/checks hoặc cảnh báo fail-on-rate / signals scope

### Requirement: prune help nêu bytes, profile và vacuum size
`nightowl prune --help` SHALL mô tả ước lượng bytes trên dry-run/prune, retention `--profile` (và quan hệ với `--days`), và tóm tắt dung lượng DB khi `--vacuum`.

#### Scenario: prune --help có profile/bytes
- **WHEN** chạy `nightowl prune --help`
- **THEN** stdout đề cập `--profile` (hoặc retention profile) và bytes hoặc disk/size / vacuum summary

### Requirement: Help và đăng ký share-pack
`nightowl --help` SHALL liệt kê lệnh share-pack (tên đã chọn). `nightowl share-pack --help` SHALL mô tả gói local offline, redaction mặc định, output/archive, và rằng lệnh không gọi mạng / không gồm tên developer.

#### Scenario: nightowl --help có share-pack
- **WHEN** chạy `nightowl --help`
- **THEN** stdout liệt kê lệnh share-pack (hoặc tên đã document)

#### Scenario: share-pack --help nêu privacy local
- **WHEN** chạy `nightowl share-pack --help`
- **THEN** stdout đề cập redaction/privacy hoặc no network / offline share

### Requirement: Help nêu timing/perf local
`nightowl doctor --help` SHALL nêu kiểm tra timing/query budget (hoặc hiệu năng đọc DB). Nếu `report` có `--debug-timing`, `report --help` SHALL mô tả cờ đó (stderr timing, không đổi JSON/text chính).

#### Scenario: doctor --help có timing
- **WHEN** chạy `nightowl doctor --help`
- **THEN** stdout đề cập timing, budget, hoặc performance/query

### Requirement: report --debug-timing opt-in
Khi có cờ `--debug-timing`, `nightowl report` SHALL in thông tin thời gian các bước đọc chính ra **stderr** và giữ stdout/JSON semantics không đổi. Mặc định không có cờ thì không in timing.

#### Scenario: Debug timing trên stderr
- **WHEN** chạy `nightowl report --debug-timing --json` trên store hợp lệ
- **THEN** stderr có timing/ms; stdout vẫn JSON report hợp lệ

### Requirement: Help nêu metric repeat và baseline
`nightowl report --help` SHALL mô tả metric repeat (lỗi lặp theo cluster key) và mọi flag baseline liên quan (ví dụ `--baseline-since`) nếu được thêm. `nightowl digest --help` và/hoặc `dashboard --help` SHALL đề cập tóm tắt repeat khi lệnh đó surface metric. Help SHALL NOT hứa sync cloud hay chấm người.

#### Scenario: report --help có repeat
- **WHEN** chạy `nightowl report --help`
- **THEN** stdout đề cập repeat, lỗi lặp, hoặc baseline window liên quan

#### Scenario: Flag baseline không hợp lệ
- **WHEN** truyền giá trị baseline không parse được (nếu flag tồn tại)
- **THEN** lệnh thoát ≠ 0 với stderr rõ, không ghi DB
