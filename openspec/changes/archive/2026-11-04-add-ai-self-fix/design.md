# Design

## Context

Xem proposal.md. Hành vi: `specs/*`.

Dữ liệu đã có:
- Sự kiện `prompt` (UserPromptSubmit) và `edit` (PostToolUse, kèm ảnh chụp file sau khi AI sửa), cùng `session_id`, theo thứ tự `id` tăng dần.
- Pre-commit lấy các lần AI sửa chưa được kiểm tra của mỗi file được stage (`listUncheckedEdits`), so ảnh chụp mới nhất với nội dung stage, rồi ghi một commit-check có `ai_event_ids`, kết quả so sánh, `staged_blob` và `staged_content`.
- Post-commit ghép commit-check có `staged_blob` bằng blob trong HEAD, rồi tạo tối đa một lỗi cho mỗi check (`attachChecks`).

## Goals / Non-Goals

**Goals:**
- Bắt được lỗi AI sửa lại sau khi dev phản hồi, mà không cần LLM.
- Ít nhiễu: không coi yêu cầu thêm tính năng là lỗi.
- Không làm chậm hay làm hỏng hook.

**Non-Goals:**
- Phân biệt "đổi ý" với "sửa lỗi" khi cả hai đều đổi dòng cũ. Việc này để LLM làm ở change sau.

## Decisions

### 1. Định nghĩa bản bị phản hồi
Với một file được stage, lấy các lần AI sửa file đó **chưa được commit nào đóng lại** (`listOpenEdits`): chưa được commit-check nào đếm, hoặc được đếm bởi một commit-check mà post-commit chưa xử lý. Trường hợp sau xảy ra khi một lần commit trước bị huỷ, ví dụ vì lint fail; nếu bỏ qua chúng thì cặp sửa trước lần huỷ bị mất.
- Ghép các lần sửa **liên tiếp trong cùng một phiên** (Eᵢ, Eᵢ₊₁). Lần sửa của phiên khác xen giữa không làm mất cặp.
- Xét các cặp theo thứ tự lần sửa trước. Cặp dùng được đầu tiên thắng. Một cặp dùng được khi:
  - có prompt cùng phiên với `Eᵢ.id < prompt.id < Eᵢ₊₁.id` (lấy prompt đầu tiên);
  - ảnh chụp Eᵢ còn đọc được và khác nội dung stage;
  - so ảnh chụp Eᵢ với **bản AI viết sau cùng** (ảnh chụp mới nhất), có ít nhất một dòng bị bỏ và không chỉ khác khoảng trắng.
- Không có cặp nào dùng được thì không có bản bị phản hồi, và mọi thứ chạy như hiện nay.

Cùng phiên vì một dev có thể mở hai cửa sổ Claude Code; prompt ở cửa sổ kia không phải phản hồi cho lần sửa này. Lấy cặp dùng được đầu tiên cho đơn giản; nhiều vòng phản hồi để sau.

Truy vấn mới `findPromptBetween(afterEditId, beforeEditId)` lọc theo `session_id` (chỉ mục `events_session`) và khoảng `id`, không đọc payload, giống `findPromptBefore`.

### 2. Pre-commit ghi gì
Khi có bản bị phản hồi Eᵢ, commit-check thêm:

```json
"self_fix": {
  "edit_id": 41,
  "feedback_event_id": 43,
  "lines_added": 1,
  "lines_removed": 1,
  "whitespace_only": false
}
```

Các số đếm là `compareContent(snapshot(Eᵢ), bản AI sau cùng)`: phần **AI** đã đổi sau phản hồi. So với bản AI chứ không phải bản stage, để dòng mà chỉ dev xoá tay không bị tính là AI tự sửa (lần đó đã là lỗi `manual-fix`).

File stage quá lớn để lưu (`staged_skipped`) thì `self_fix` là `null`, vì post-commit không có bản commit để ghi. Mọi lỗi khi tìm `self_fix` đều cho `null`, không làm hỏng commit-check. Pre-commit không lưu thêm nội dung nào: ảnh chụp Eᵢ đã có trong bảng `events`. Ngân sách 2 giây của hook không đổi.

### 3. Khi nào thành lỗi
Post-commit, với check khớp HEAD (logic hiện có không đổi):
- Lỗi `manual-fix`: như hiện nay.
- Lỗi `ai-self-fix` khi `self_fix` có `lines_removed > 0`, `whitespace_only` là `false`, `staged_content` là chuỗi, ảnh chụp Eᵢ còn đọc được, và `isFeedbackFor(Eᵢ, prompt, file)` xác nhận lại trong database rằng prompt đó thật sự là prompt cùng phiên, sau Eᵢ và trước một lần AI sửa file đó sau nó. Payload của commit-check không được tin một mình.
  - `ai_content` = ảnh chụp Eᵢ (bản bị phản hồi).
  - `final_content` = `staged_content` (bản commit).
  - `ai_event_id` = Eᵢ.
  - `prompt_event_id` = prompt trước Eᵢ.
  - `feedback_event_id` = prompt phản hồi.

So với bản commit khi lưu: nếu dev còn sửa tay tiếp, bản commit mới là "đúng" theo dev.

Giới hạn đã biết: AI chỉ đổi thứ tự dòng thì không có dòng nào bị bỏ, nên không được tính. AI đổi thụt lề kèm sửa thật thì mọi dòng đổi thụt lề đều bị đếm là bị bỏ; số đếm chỉ dùng để quyết định có lỗi hay không, nên điều này không làm sai kết quả.

### 4. Lưu nhiều lỗi cho một check
`Attachment` của outcome `failure` đổi từ một `failure` thành `failures` (một hoặc hai phần tử). `checks_attached.failure_id` giữ id của lỗi đầu tiên (`manual-fix` nếu có), để không phải đổi bảng đó. Tỷ lệ "bị sửa" trong `report` vẫn đếm theo check, nên một check có hai lỗi vẫn là một lần AI sửa bị đổi.

Check chỉ có lỗi `ai-self-fix` (bản AI gần nhất khớp bản commit) có outcome `failure`. Như vậy tỷ lệ bị sửa phản ánh cả lần AI phải sửa lại theo phản hồi.

### 5. Schema v4
```sql
ALTER TABLE failures ADD COLUMN source TEXT NOT NULL DEFAULT 'manual-fix'
  CHECK (source IN ('manual-fix', 'ai-self-fix'));
ALTER TABLE failures ADD COLUMN feedback_event_id INTEGER REFERENCES events (id);
```
Dữ liệu cũ thành `manual-fix`, đúng với cách nó được tạo ra.

### 6. Report, export, classify
- `report`: dòng `By source: manual-fix N, ai-self-fix M`; JSON `by_source` với cả hai khoá (kể cả khi bằng 0).
- `export`: sau `commit_sha` thêm `source`; trong `input` thêm `feedback` (chuỗi hoặc `null`). Thứ tự khoá cố định. `id` không đổi, vì nó chỉ phụ thuộc commit và id lỗi.
- `eval`: đọc thêm `input.feedback` là không bắt buộc, và không gửi nó cho model. Bài test vẫn là "làm đúng yêu cầu ban đầu", chứ không phải "sửa theo gợi ý".
- `classify`: khi có prompt phản hồi, prompt gửi LLM có thêm khối `<feedback>…</feedback>` (giới hạn và escape như các khối khác).

## Risks / Trade-offs

- [Đổi ý có sửa dòng cũ, ví dụ "đổi tên hàm thành X", vẫn bị ghi là lỗi] → Ghi với `source = ai-self-fix` để lọc hoặc xem riêng; `classify` thấy prompt phản hồi; dev có thể `dismissed`. Phán định bằng LLM để change sau.
- [Prompt không liên quan xen giữa hai lần sửa, ví dụ hỏi một câu khác] → Vẫn cần lần sửa sau bỏ dòng cũ mới thành lỗi; nhiễu còn lại được ghi nhận như trên.
- [`changed_rate` theo tuần trộn hai đơn vị: số lỗi đếm theo lỗi, số bị sửa đếm theo check] → Một check có hai lỗi làm hai cột lệch nhau. Chấp nhận ở MVP; báo cáo ghi rõ % là "AI edits changed".
- [Nội dung prompt phản hồi có thể chứa thông tin nhạy cảm] → Xử lý như prompt hiện có: chỉ lưu trong máy, chỉ gửi đi khi `classify --yes`, file export ở chế độ 0600.
- [Thêm truy vấn trong hook] → Lọc theo chỉ mục `events_session` và không đọc payload; test đo thời gian như các hook khác.
