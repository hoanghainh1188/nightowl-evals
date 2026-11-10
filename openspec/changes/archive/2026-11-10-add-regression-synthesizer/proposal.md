# Proposal

## Why

NightOwl đã có `export` (JSONL eval) và `eval` (chạy lại model), nhưng mỗi lần dev sửa lỗi AI vẫn chưa thành bài test hồi quy nằm trong suite của dự án. Cần lệnh biến failure `confirmed` thành khung regression test local để CI/team giữ được tài sản đó, không phụ thuộc NightOwl DB.

## What Changes

- Thêm lệnh CLI (tên đề xuất: `nightowl suggest-regressions`) đọc failure đã lọc (mặc định `confirmed`), tái dùng dữ liệu kiểu `nightowl.eval/v1`, và **sinh khung** fixture/test hồi quy ra đường dẫn chỉ định.
- **Mặc định dry / stdout preview**: không ghi file project và không gọi LLM. Chỉ ghi khi user chỉ path/`--output` (hoặc tương đương) rõ ràng; `--force` khi ghi đè file không phải artifact NightOwl đã biết.
- Template offline theo framework đã chọn hoặc detect nhẹ (`vitest` / `jest` / fixture JSON thuần); không bắt buộc LLM. Opt-in LLM (nếu có) chỉ để diễn đạt tên/mô tả test, không gửi code ra mạng trừ khi user bật.
- Bộ lọc giống export/review: `--since`, `--category`, `--agent`, `--status`, `--limit`; bỏ bản ghi nhạy cảm (path + inline secret) như `export`.
- Không auto-commit git; không đổi hook; không đổi schema SQLite bắt buộc cho v1.

## Capabilities

### New Capabilities

- `regression-synthesis`: sinh khung regression test/fixture local từ failure đã ghi, an toàn secret, không tự merge vào suite trừ khi user chỉ định ghi file

### Modified Capabilities

- `cli`: đăng ký lệnh `suggest-regressions` (và help/flags liên quan)

## Impact

- Lệnh mới (`src/commands/suggest-regressions.ts` + module `src/regressions/` hoặc tương đương), tái dùng `toEvalCase` / query failure / secret filter / pattern ghi an toàn của `export` và `suggest-rules`.
- README: ví dụ sinh vào `test/regressions/` hoặc `.nightowl/regressions/`.
- Không đụng hook Claude/git; không telemetry.
