# NightOwl Evals – Đề xuất sản phẩm

Nov 4, 2026 · @Nguyen Han Hoang Hai

Công cụ tự động ghi lại mỗi lần AI viết code sai. Gom lỗi thành bộ test riêng của dự án. Dùng nội bộ công ty trước, sau đó bán SaaS cho các công ty sản xuất phần mềm.

## Vấn đề

AI sai, dev sửa tay, rồi lỗi đó mất luôn. Lần sau AI lại sai y hệt.

- Không ai ghi lại AI sai ở đâu, sai kiểu gì.
- Bộ test công khai (như SWE-bench) quá chung. Không phản ánh code base riêng của dự án.
- Đổi model hay đổi prompt thì không có số liệu để biết tốt hơn hay tệ hơn.
- Khách hàng hỏi "AI giúp được bao nhiêu?" thì không có con số trả lời.

## Giải pháp

Ghi lỗi tự động, không bắt dev nhập tay. Mỗi lỗi thành một bài test chạy lại được.

| Nguồn | Bắt được gì | Độ khó |
| --- | --- | --- |
| Hook của agent (Claude Code, Cursor) | Prompt, ngữ cảnh, code AI sinh ra | Thấp |
| Git diff trước commit | Phần dev sửa lại trên code AI | Trung bình |
| Test / build fail | Code AI chạy lỗi ngay | Thấp |
| Comment review trong PR | Lỗi logic, sai convention | Trung bình |
| Revert sau vài ngày | Lỗi lọt qua review | Cao |

Luồng xử lý:

1. Thu thập: hook + git hook ghi sự kiện.
2. Ghép: nối code AI sinh ra với bản dev sửa.
3. Phân loại: sai logic, sai convention, hiểu sai yêu cầu, thiếu ngữ cảnh.
4. Lọc nhiễu: bỏ các lần dev chỉ đổi ý.
5. Xuất bộ test: mỗi lỗi = đầu vào + code đúng + tiêu chí chấm.
6. Chạy lại: so điểm giữa các model, prompt, rules.

Đầu ra cho người dùng:

- Dashboard lỗi theo loại, theo module.
- Gợi ý luật mới cho CLAUDE.md / rules.
- Báo cáo chất lượng AI cho khách hàng.

## Khách hàng và lộ trình

Khách hàng mục tiêu: mọi công ty sản xuất phần mềm có dùng AI để code. Làm cho mình trước, chứng minh hiệu quả, rồi mới bán.

| Giai đoạn | Người dùng | Mục tiêu | Điều kiện qua giai đoạn |
| --- | --- | --- | --- |
| 1. Bản thân | Dự án cá nhân của anh | Tool chạy được, ghi đủ lỗi | ≥ 50 lỗi thật được ghi tự động |
| 2. Công ty | 2–3 team trong công ty | Có số liệu so model, cải thiện rules | Tỷ lệ lỗi lặp lại giảm rõ |
| 3. SaaS beta | 3–5 công ty phần mềm bên ngoài | Kiểm tra họ có chịu trả tiền | ≥ 1 khách trả phí |
| 4. SaaS | Công ty outsource VN, khách Nhật | Bán chính thức | — |

Phân khúc nên nhắm trước khi bán:

- Công ty outsource Việt Nam làm cho Nhật: cùng nỗi đau, anh hiểu rõ.
- Họ cần báo cáo chất lượng cho khách. Đây là lý do để trả tiền.

## Đối thủ

Chưa ai làm tốt mảng "lỗi AI code → bộ test riêng của dự án". Đó là khoảng trống.

| Nhóm | Ví dụ | Làm gì | Thiếu gì |
| --- | --- | --- | --- |
| Eval chung | Braintrust, LangSmith, Langfuse, [Atla](https://atla-ai.com) | Chấm điểm sản phẩm AI | Không làm riêng cho team code |
| Review code | CodeRabbit, Greptile | Bắt lỗi trong PR | Không gom lỗi thành bộ test |
| Tool nhỏ mới | [TreeTrace](https://devbytes.co.in/news/treetrace-a-tool-to-track-human-corrections-to-ai-coding-agents) | Ghi lại dev sửa code AI | Chưa có eval, báo cáo |

Điểm khác biệt nên giữ:

- Chạy on-premise được.
- Báo cáo song ngữ Việt – Nhật.
- Bộ test sinh tự động từ chính dự án.

## Rủi ro

Rủi ro lớn nhất là bảo mật code. Thiết kế on-premise ngay từ đầu.

| Rủi ro | Mức | Cách xử lý |
| --- | --- | --- |
| Khách không cho code ra ngoài | Cao | Xin phép từng dự án trước khi bật; bản on-premise, dữ liệu không rời máy chủ khách |
| Dữ liệu nhiễu (dev đổi ý, không phải AI sai) | Cao | Lọc tự động + cho dev đánh dấu nhanh 1 click |
| Dev ngại bị theo dõi | Trung bình | Nói rõ chấm AI, không chấm người; ẩn tên dev |
| Hãng lớn tự làm tính năng này | Trung bình | Giữ lợi thế ở dữ liệu, on-premise, thị trường VN–Nhật |
| Tốn công bảo trì hook cho nhiều tool | Trung bình | Chỉ hỗ trợ Claude Code + Git trước |

## MVP – 4 tuần đầu (Đã hoàn thành)

Mục tiêu: ghi được lỗi thật trên dự án cá nhân của anh. Dữ liệu lưu ở máy local. Chưa cần đẹp.

- [x] Tuần 1: Claude Code hook ghi prompt + code AI sinh ra vào file JSON / SQLite.
- [x] Tuần 1: Git pre-commit hook so diff, gắn cờ "code AI bị sửa".
- [x] Tuần 2: Ghép bản AI với bản dev sửa thành 1 bản ghi lỗi.
- [x] Tuần 2: Phân loại lỗi bằng LLM (4 loại cơ bản).
- [x] Tuần 3: Dashboard đơn giản: lỗi theo loại, theo module, theo tuần.
- [x] Tuần 3: Xuất bộ test dạng JSONL.
- [x] Tuần 4: Chạy lại bộ test với 2 model, so điểm.
- [x] Tuần 4: Tổng kết: đáng làm tiếp không? (Kết luận: Dự án đạt chất lượng kỹ thuật cao, tiếp tục phát triển theo kế hoạch Production-Ready).

Chi tiết mức độ sẵn sàng kỹ thuật: xem [`docs/production-readiness.md`](production-readiness.md). Lộ trình ideation: v0.5 Done — [`docs/v0.5-roadmap-ideas.md`](v0.5-roadmap-ideas.md); tiếp theo — [`docs/v0.6-roadmap-ideas.md`](v0.6-roadmap-ideas.md).

## Chuyển giao cho Claude Code

Phần này dùng để mở phiên Claude Code. Xuất doc ra Markdown, lưu vào repo tại `docs/nightowl-evals.md`.

### Thông tin kỹ thuật đã chốt

| Mục | Quyết định |
| --- | --- |
| Tên package | `@hoanghainh/nightowl-evals` |
| Lệnh CLI | `nightowl` |
| Ngôn ngữ | TypeScript, Node 22+ |
| Lưu trữ | `node:sqlite`, file tại `.nightowl/nightowl.db` trong dự án |
| Build / test | tsup, vitest |
| Phạm vi MVP | Chỉ Claude Code + Git |
| Quy trình spec | OpenSpec |
| Dự án thử đầu tiên | Dự án cá nhân của anh |
| Phát hành | `npm publish --access public` |
| License | Apache-2.0 (repo công khai) |

### License

Mô hình open-core: phần thu thập mở mã nguồn theo Apache-2.0, phần kiếm tiền giữ riêng.

| Phần | Repo | License |
| --- | --- | --- |
| CLI, hook, lưu SQLite, report và export cơ bản | Công khai: `nightowl-evals` | Apache-2.0 |
| Dashboard cho team, phân tích nâng cao | Riêng tư | Thương mại |
| Bản on-premise, SaaS | Riêng tư | Thương mại |

Lý do chọn Apache-2.0:

- Pháp lý doanh nghiệp (kể cả khách Nhật) duyệt nhanh.
- Có điều khoản patent, bảo vệ người dùng.
- Mã nguồn mở giúp khách tin tool không gửi code ra ngoài.
- Tránh AGPL vì nhiều công ty cấm dùng.

Việc cần làm khi tạo repo:

- [x] Chọn **Apache License 2.0** khi tạo repo trên GitHub.
- [x] `package.json`: `"license": "Apache-2.0"`.
- [x] Thêm file `NOTICE`: `NightOwl Evals — Copyright 2026 Hoang Hai`.
- [ ] Cân nhắc đăng ký thương hiệu "NightOwl Evals" trước khi bán SaaS.

Đây là thông tin chung, không phải tư vấn pháp lý. Hỏi lại luật sư trước khi bán SaaS.

### Nguyên tắc bắt buộc

- Không gửi code hay dữ liệu ra ngoài máy. Mọi thứ lưu local.
- Tính năng gọi LLM (phân loại lỗi) phải tắt mặc định. Người dùng tự bật.
- Hook không được làm chậm hay chặn Claude Code / git commit. Lỗi trong hook chỉ ghi log, không dừng.
- Thêm `.nightowl/` vào `.gitignore` khi chạy `init`.

### Các bước setup

1. Tạo repo mới `nightowl-evals`.
2. `npm i -g @fission-ai/openspec` rồi `openspec init`, chọn Claude Code (và các tool khác nếu cần).
3. Copy doc này vào `docs/nightowl-evals.md`.
4. Nhờ agent điền `openspec/config.yaml` `context` / `rules` từ doc (không dùng `project.md`).
5. Làm lần lượt các change bên dưới.

### Danh sách change OpenSpec

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

### Prompt mở đầu phiên

```text
Bạn là dev chính của dự án NightOwl Evals.
Đọc docs/nightowl-evals.md trước. Đây là nguồn sự thật.

Việc 1: điền openspec/config.yaml (context, rules, operations) từ doc — mục tiêu, tech stack, nguyên tắc bắt buộc.
Việc 2: tạo change "add-cli-skeleton" theo bảng Danh sách change.
Dừng lại để tôi duyệt proposal trước khi code.

Luôn tuân thủ: không gửi dữ liệu ra ngoài máy, hook không được chặn agent hay git commit.
Repo dùng license Apache-2.0: tạo LICENSE, NOTICE và ghi license trong package.json.
```

## Câu hỏi mở

- [x] Thử trên dự án nào đầu tiên? Trả lời: Thử dự án cá nhân.
- [x] Công ty có cho phép ghi log code dự án khách không? Trả lời: tuỳ dự án, cần xin phép trước khi dùng.
- [x] Lưu trữ ở đâu: máy local, server công ty, hay cloud? Trả lời: ở MVP thì nên ở máy local.
- [x] Tên sản phẩm chính thức? Trả lời: NightOwl Evals

## Nguồn tham khảo

- [TreeTrace – track human corrections to AI coding agents](https://devbytes.co.in/news/treetrace-a-tool-to-track-human-corrections-to-ai-coding-agents)
- [Atla – Find and fix AI agent failures](https://atla-ai.com)
- [Best AI evaluation tools for agents 2026 – Latitude](https://latitude.so/blog/best-ai-evaluation-tools-agents-production-2026-perplexity)
- [Evaluating coding agents 2026 – FutureAGI](https://futureagi.com/blog/evaluating-coding-agents-2026/)
- [Why AI coding agents keep making the same mistakes – HackerNoon](https://hackernoon.com/why-ai-coding-agents-keep-making-the-same-mistakes-and-how-to-stop-them)
