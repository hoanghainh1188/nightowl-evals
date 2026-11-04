# Design

## Context

Xem proposal.md. Hành vi: `specs/eval-export`. Dựa trên bảng `failures` (schema v3): `ai_content`, `final_content`, `commit_sha`, `prompt_event_id`, `category*`, `status`, `created_at`. Change 9 sẽ đọc file xuất.

## Goals / Non-Goals

**Goals:**
- Một định dạng bài test tự đủ: change 9 chạy được mà không cần đọc database hay git.
- Xuất lại cho kết quả giống hệt, để so giữa các lần chạy.

**Non-Goals:**
- Chấm điểm, chọn model, tiêu chí do người dùng viết.

## Decisions

### 1. Một dòng = một bài test
```json
{ "schema": "nightowl.eval/v1",
  "id": "3f2a9c1d8e07-42",
  "file_path": "src/a.ts",
  "commit_sha": "3f2a9c1…",
  "created_at": "2026-11-04T10:00:00.000Z",
  "input": { "prompt": "add email validation", "file_before": "…" },
  "rejected": "<bản AI viết>",
  "expected": "<bản dev commit>",
  "category": "logic", "category_reason": "…", "category_confidence": 0.8,
  "criteria": { "type": "reference",
                "description": "The output should match the intent of `expected` and must not repeat the defect in `rejected`." } }
```
- `id` = 12 ký tự đầu của `commit_sha` + `-` + số của bản ghi lỗi (`failure-<số>` khi thiếu `commit_sha`). Chỉ phụ thuộc vào chính bản ghi, nên không đổi khi lọc khác hay khi bản ghi khác bị loại. (Bản đầu dùng đường dẫn file, nhưng cách chống trùng phụ thuộc vào thứ tự xuất nên `id` đổi theo bộ lọc; review đã chỉ ra.)
- Khoá được ghi theo thứ tự cố định ở trên; JSON không thụt dòng.

### 2. File trước commit lấy từ git
Đầu vào là các dòng `<commit_sha>^:<file_path>` (bỏ trùng; `commit_sha` phải là chuỗi hex để git không hiểu thành biểu thức khác). Trước hết `git cat-file --batch-check` lấy kích thước, rồi một `git cat-file --batch` chỉ đọc các blob ≤ 512 KB, nên file lớn không bao giờ được nạp vào bộ nhớ. Mỗi lệnh git bị huỷ sau 30 giây. Nội dung phải là UTF-8 hợp lệ và không có byte `0`. File thiếu, commit thiếu (đã rebase hoặc gc), commit gốc không có cha, đường dẫn chứa xuống dòng, file nhị phân hoặc quá lớn → `null`.
*Phương án khác:* lưu bản trước lúc `post-commit`. Cần thêm cột, tốn thời gian trong hook, và vẫn không có cho dữ liệu đã ghi; git đã giữ sẵn bản này.
`file_before` là trạng thái commit trước, không phải đúng lúc AI bắt đầu sửa; giữa hai thời điểm có thể có thay đổi chưa commit. Chấp nhận ở MVP.

### 3. Tiêu chí chấm là mô tả, có `type`
Bản v1 chỉ có `type: "reference"`. Change 9 đọc `type` để chọn cách chấm; thêm kiểu khác về sau không phá file cũ.

### 4. Ghi file an toàn
Dùng lại `writeFileAtomic` (`src/setup/fs-utils.ts`): file tạm cùng thư mục, cờ `wx`, không ghi xuyên symlink, rồi đổi tên. Bổ sung tuỳ chọn quyền `0o600`. Thư mục `.nightowl/export/` được tạo với quyền `0o700`. Đường dẫn `--out` tương đối tính từ thư mục hiện tại; thư mục cha phải tồn tại sẵn (không tạo cây thư mục theo tham số).

### 5. Không xuất file nhạy cảm, không ghi đè file lạ
Bản ghi của file thuộc nhóm bí mật (`isSensitivePath`, cùng quy tắc với hook) bị bỏ ngay cả khi database có sẵn, phòng dữ liệu từ bản NightOwl cũ. `--out` chỉ thay được file rỗng hoặc file xuất trước đó (dòng đầu bắt đầu bằng `{"schema":"nightowl.eval/`); file khác cần `--force`. Đích là symlink luôn bị từ chối. Nếu `git check-ignore` cho biết file đích không bị bỏ qua, stderr cảnh báo file có thể bị commit.

### 6. Đọc theo lô
Bản ghi lỗi được đọc theo thứ tự `id`, lọc bằng SQL (`status != 'dismissed'`, `--since`, `--category`). Nội dung được ghép thành chuỗi rồi ghi một lần; với mốc MVP vài trăm lỗi, mỗi lỗi tối đa vài MB, là đủ. Đọc theo luồng để sau nếu cần.

### 7. Kiểm tra trước khi mở database
Giống `report`: kiểm tra tuỳ chọn trước, rồi mở database chỉ đọc qua `openExistingStore` (design `add-report` mục 4).

## Risks / Trade-offs

- [File xuất chứa code của dự án] → Mặc định nằm trong `.nightowl/` (đã `.gitignore`), quyền `0600`; stderr nhắc file chứa code. Không có gì rời máy.
- [Định dạng v1 cần đổi khi làm change 9] → Có trường `schema`; đổi thì tăng lên `v2` và change 9 đọc cả hai.
- [`file_before` không đúng lúc AI bắt đầu] → Ghi rõ ở design; có thể cải thiện bằng cách dựng ngược từ các sự kiện `edit` sau này.
