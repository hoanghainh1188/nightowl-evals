# NightOwl Evals — Project Context

Nguồn sự thật: [`docs/nightowl-evals.md`](../docs/nightowl-evals.md). File này tóm tắt những gì mọi change OpenSpec phải tuân theo. Khi hai file mâu thuẫn, doc gốc thắng và file này phải được sửa lại.

## Mục tiêu

Công cụ CLI tự động ghi lại mỗi lần AI viết code sai, gom lỗi thành bộ test riêng của dự án.

- Thu thập: hook của Claude Code + git hook ghi sự kiện, không bắt dev nhập tay.
- Ghép: nối code AI sinh ra với bản dev sửa thành một bản ghi lỗi.
- Phân loại: sai logic, sai convention, hiểu sai yêu cầu, thiếu ngữ cảnh.
- Lọc nhiễu: bỏ các lần dev chỉ đổi ý.
- Xuất bộ test: mỗi lỗi = đầu vào + code đúng + tiêu chí chấm (JSONL).
- Chạy lại: so điểm giữa các model, prompt, rules.

### Giai đoạn: Chuẩn bị phát hành Production-Ready

- **Giai đoạn MVP (4 tuần)**: Đã hoàn thành 100% (9/9 changes, test coverage > 95%).
- **Giai đoạn hiện tại**: Hoàn thiện độ tin cậy, đa nền tảng và vận hành dữ liệu (Production Hardening) dựa trên kế hoạch tại [`docs/production-readiness.md`](../docs/production-readiness.md).
- Phạm vi hiện tại: Tiếp tục tối ưu hóa cho Claude Code + Git, đảm bảo tương thích ổn định trên macOS, Linux, Windows và bảo vệ dữ liệu nhạy cảm.

## Tech stack

| Mục | Quyết định |
| --- | --- |
| Tên package | `@hoanghainh/nightowl-evals` |
| Lệnh CLI | `nightowl` |
| Ngôn ngữ | TypeScript, Node 22+ |
| Lưu trữ | `node:sqlite`, file tại `.nightowl/nightowl.db` trong dự án đích |
| Build | tsup |
| Test | vitest |
| Quy trình spec | OpenSpec (schema `spec-driven`) |
| Phát hành | `npm publish --access public` |
| License | Apache-2.0 |

## Nguyên tắc bắt buộc

Mọi change phải giữ đủ các nguyên tắc này. Proposal nào vi phạm phải nói rõ và được duyệt riêng.

1. **Không gửi dữ liệu ra ngoài máy.** Code, prompt, diff và mọi bản ghi chỉ lưu local. Không telemetry, không analytics, không gọi mạng ngầm.
2. **Tính năng gọi LLM tắt mặc định.** Phân loại lỗi bằng LLM chỉ chạy khi người dùng tự bật rõ ràng.
3. **Hook không được làm chậm hay chặn Claude Code / git commit.** Hook luôn thoát mã 0; lỗi bên trong hook chỉ ghi log, không ném ra ngoài, không in ra stderr theo cách làm agent hoặc git dừng lại.
4. **`nightowl init` thêm `.nightowl/` vào `.gitignore`** của dự án đích.
5. **Chấm AI, không chấm người.** Không lưu hay hiển thị tên dev trong báo cáo.

## License (open-core)

- Repo công khai `nightowl-evals` (CLI, hook, lưu SQLite, report và export cơ bản): Apache-2.0.
- Dashboard team, phân tích nâng cao, on-premise, SaaS: repo riêng, license thương mại. Không đưa code các phần này vào repo này.
- `package.json` phải có `"license": "Apache-2.0"`. File `NOTICE`: `NightOwl Evals — Copyright 2026 Hoang Hai`.

## Quy ước

- Viết artifact OpenSpec bằng tiếng Việt; từ khoá yêu cầu (`SHALL`, `MUST`) và tên định danh giữ tiếng Anh.
- Commit theo conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`.
- TDD: viết test trước, mục tiêu coverage ≥ 80%.
- File nhỏ, tổ chức theo tính năng; hàm < 50 dòng; ưu tiên dữ liệu bất biến.
- Phụ thuộc runtime tối thiểu; ưu tiên module có sẵn của Node (`node:sqlite`, `node:util` `parseArgs`, `node:fs`).

## Lộ trình change

### Các change MVP đã hoàn thành

| Thứ tự | Change | Nội dung | Trạng thái |
| --- | --- | --- | --- |
| 1 | `add-cli-skeleton` | Khung TypeScript, bin `nightowl`, lệnh rỗng, build, test | Hoàn thành |
| 2 | `add-local-storage` | Schema SQLite: bảng `events`, `failures` | Hoàn thành |
| 3 | `add-claude-code-hook` | `nightowl init` ghi hook vào `.claude/settings.json` (PostToolUse cho Edit/Write); `nightowl log` đọc JSON từ stdin | Hoàn thành |
| 4 | `add-git-hook` | pre-commit so code AI viết với code được commit, gắn cờ "bị sửa" | Hoàn thành |
| 5 | `add-failure-records` | Ghép bản AI + bản dev sửa thành 1 bản ghi lỗi | Hoàn thành |
| 6 | `add-llm-classify` | Phân loại 4 loại lỗi, tắt mặc định | Hoàn thành |
| 7 | `add-report` | `nightowl report`: lỗi theo loại, module, tuần | Hoàn thành |
| 8 | `add-export` | `nightowl export`: xuất bộ test JSONL | Hoàn thành |
| 9 | `add-eval-run` | Chạy lại bộ test với 2 model, so điểm | Hoàn thành |

### Lộ trình change tiếp theo (Production-Ready)

Chi tiết xem [`docs/production-readiness.md`](../docs/production-readiness.md):

| Thứ tự | Change | Nội dung | Ưu tiên |
| --- | --- | --- | --- |
| 10 | `fix-cross-platform-process` | Khắc phục kill process group trên Windows trong `run-claude.ts` | Hoàn thành |
| 11 | `add-inline-secret-filter` | Bổ sung regex quét secret inline cho snapshot | Hoàn thành |
| 12 | `add-doctor-command` | Lệnh `nightowl doctor` chẩn đoán cấu hình môi trường | Hoàn thành |
| 13 | `add-storage-prune` | Cơ chế dọn dẹp snapshot cũ và tối ưu dung lượng SQLite | Hoàn thành |
| 14 | `add-hook-manager-support` | Hỗ trợ cấu hình tích hợp Husky và Lefthook | Hoàn thành |
| 15 | `add-report-json` | Thêm cờ `--json` cho `nightowl report` | Hoàn thành |
| 16 | `add-eval-test-runner` | Hỗ trợ chạy kiểm thử tự động (unit tests) để verify eval | Hoàn thành |
| 17 | `add-direct-api-classify` | Hỗ trợ gọi phân loại trực tiếp qua LLM API key | Hoàn thành |

### Định hướng mở rộng tương lai (v0.3.0+ Ideation)

Chi tiết xem [`docs/v0.3-roadmap-ideas.md`](../docs/v0.3-roadmap-ideas.md):

| Thứ tự | Ý tưởng Change | Mô tả tóm tắt | Trạng thái |
| :---: | :--- | :--- | :---: |
| 18 | `add-multi-agent-support` | Bắt snapshot lỗi từ Cursor, Windsurf, Cline, Copilot; thống kê so sánh đối đầu | Dự kiến |
| 19 | `add-rule-synthesis` | Lệnh `nightowl suggest-rules` tự động sinh quy tắc vào CLAUDE.md từ lỗi lặp lại | Dự kiến |
| 20 | `add-regression-synthesizer` | Tự động tạo test case hồi quy cho dự án mỗi khi dev sửa lỗi AI | Dự kiến |
| 21 | `add-tui-review` | Giao diện TUI tương tác bàn phím (↑/↓, Space, c, d) cho `nightowl review -i` | Dự kiến |
| 22 | `add-github-action` | Composite GitHub Action chạy CI quality gate & comment báo cáo trên PR | Dự kiến |
| 23 | `add-swebench-export` | Xuất dataset theo format SWE-bench và Promptfoo cho enterprise eval | Dự kiến |
| 24 | `add-shell-completion` | Hỗ trợ tab completion cho Bash, Zsh, Fish | Dự kiến |

