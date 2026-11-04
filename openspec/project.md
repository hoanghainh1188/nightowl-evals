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

### Giai đoạn hiện tại: MVP 4 tuần

Ghi được lỗi thật trên dự án cá nhân của tác giả. Dữ liệu ở máy local. Chưa cần đẹp.
Điều kiện qua giai đoạn: ≥ 50 lỗi thật được ghi tự động.

Phạm vi MVP chỉ gồm **Claude Code + Git**. Cursor, review comment trong PR, phát hiện revert, dashboard web, on-premise server và SaaS nằm ngoài phạm vi.

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

| Thứ tự | Change | Nội dung | Tuần |
| --- | --- | --- | --- |
| 1 | `add-cli-skeleton` | Khung TypeScript, bin `nightowl`, lệnh rỗng, build, test | 1 |
| 2 | `add-local-storage` | Schema SQLite: bảng `events`, `failures` | 1 |
| 3 | `add-claude-code-hook` | `nightowl init` ghi hook vào `.claude/settings.json` (PostToolUse cho Edit/Write); `nightowl log` đọc JSON từ stdin | 1 |
| 4 | `add-git-hook` | pre-commit so code AI viết với code được commit, gắn cờ "bị sửa" | 1 |
| 5 | `add-failure-records` | Ghép bản AI + bản dev sửa thành 1 bản ghi lỗi | 2 |
| 6 | `add-llm-classify` | Phân loại 4 loại lỗi, tắt mặc định | 2 |
| 7 | `add-report` | `nightowl report`: lỗi theo loại, module, tuần | 3 |
| 8 | `add-export` | `nightowl export`: xuất bộ test JSONL | 3 |
| 9 | `add-eval-run` | Chạy lại bộ test với 2 model, so điểm | 4 |
