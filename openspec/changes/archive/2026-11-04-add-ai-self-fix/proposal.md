# Proposal

## Why

NightOwl hiện chỉ bắt được lỗi khi dev **sửa tay** code AI trước khi commit. Lúc commit, pre-commit so nội dung được stage với *bản AI viết gần nhất*.

Nhưng cách sửa phổ biến không kém là **bảo chính AI sửa**:
1. AI viết `age > 18` (sai).
2. Dev nhắn "sai rồi, từ 18 tuổi là đủ", và AI sửa thành `age >= 18`.
3. Dev commit.

Bản AI gần nhất khớp bản commit, nên NightOwl cho là AI viết đúng. Bản sai ở bước 1 vẫn nằm trong database nhưng không có gì dùng tới nó. Các lỗi kiểu này mất hết, dù chúng chính là thứ doc muốn gom: "AI sai, … rồi lỗi đó mất luôn".

Prompt phản hồi ("sai rồi, …") còn là dữ liệu quý: nó nói rõ AI sai ở đâu, giúp phân loại và giúp bộ test.

## What Changes

- **Nhận diện "AI tự sửa theo phản hồi".** Trong cùng một phiên Claude Code, khi AI sửa một file, *dev gửi prompt mới*, rồi AI sửa lại file đó, thì bản AI viết ngay trước prompt đó là bản bị phản hồi.
  - Chỉ có prompt của dev mới tách các lần sửa. Các lần AI chỉnh dần trong cùng một lượt trả lời không tính.
- **Pre-commit ghi thêm** vào commit-check: bản bị phản hồi (id lần sửa), prompt phản hồi, và kết quả so bản đó với nội dung được stage.
- **Post-commit tạo bản ghi lỗi nguồn `ai-self-fix`** khi bản bị phản hồi khác bản commit và có ít nhất một dòng của nó bị bỏ hoặc đổi, không chỉ khác khoảng trắng.
  - Nếu prompt sau chỉ thêm dòng mới (thường là yêu cầu thêm tính năng), không ghi lỗi. Đây là bước lọc nhiễu rẻ nhất, theo "bỏ các lần dev chỉ đổi ý" trong doc.
- Mỗi file trong mỗi commit có tối đa **một** lỗi `ai-self-fix`, lấy theo prompt phản hồi đầu tiên. Lỗi sửa tay hiện có (nguồn `manual-fix`) vẫn được ghi như cũ. Hai loại có thể cùng xuất hiện, vì chúng là hai lỗi khác nhau.
- **Schema v4:** bảng `failures` thêm `source` (`manual-fix` hoặc `ai-self-fix`, mặc định `manual-fix` cho dữ liệu cũ) và `feedback_event_id`.
- **Dùng ở các lệnh khác:**
  - `report` thêm một dòng đếm theo nguồn; `--json` thêm `by_source`.
  - `export` thêm `source` và `input.feedback` (nội dung prompt phản hồi, `null` với lỗi sửa tay). Schema vẫn là `nightowl.eval/v1`, vì đây chỉ là trường thêm vào.
  - `classify` gửi kèm prompt phản hồi khi có, để LLM phân loại chính xác hơn. Lệnh vẫn tắt mặc định và chỉ gửi khi có `--yes`.
- Không gửi gì ra ngoài máy; hook vẫn không bao giờ chặn Claude Code hay git commit.

Ngoài phạm vi:
- Nhiều vòng phản hồi trên cùng một file trong một commit (chỉ lấy vòng đầu).
- Dùng LLM để loại các lần "đổi ý" có sửa dòng cũ. `classify` hiện chỉ gắn loại lỗi; thêm phán định `not-a-failure` là change riêng.
- AI tự sửa mà không có prompt của dev ở giữa (ví dụ AI tự chạy test rồi sửa).

## Capabilities

### New Capabilities

(không có)

### Modified Capabilities

- `git-hook`: commit-check ghi thêm bản bị phản hồi.
- `failure-records`: tạo lỗi nguồn `ai-self-fix`.
- `local-storage`: schema v4, cột `source` và `feedback_event_id`.
- `failure-report`: đếm theo nguồn.
- `eval-export`: trường `source` và `input.feedback`.
- `failure-classification`: gửi kèm prompt phản hồi.

## Impact

- Code:
  - `src/hooks/git/check-commit.ts`: tìm bản bị phản hồi.
  - `src/hooks/git/attach-commit.ts`: tạo lỗi `ai-self-fix`.
  - `src/storage/`: migration v4, truy vấn prompt giữa hai lần sửa, `attachChecks` nhận nhiều lỗi cho một check.
  - `src/report/`, `src/export/`, `src/classify/prompt.ts`.
- Schema đổi sang v4: lệnh đọc (`report`, `export`, `eval`) báo chạy `nightowl init` trên database cũ, như các lần đổi schema trước.
- Không thêm dependency.
