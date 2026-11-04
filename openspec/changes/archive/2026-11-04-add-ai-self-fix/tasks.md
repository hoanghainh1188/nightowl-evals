# Tasks

## 1. Lưu trữ

- [x] 1.1 Viết test cho migration v4 (nâng từ v3, giá trị mặc định, CHECK của `source`); thêm entry vào `src/storage/migrations.ts` để pass
- [x] 1.2 Viết test cho `findPromptBetween` (cùng phiên, khác phiên, không có prompt); cài trong `src/storage/` để pass
- [x] 1.3 Viết test cho `attachChecks` nhận một hoặc hai lỗi cho một check, lưu `source` và `feedback_event_id`, `checks_attached.failure_id` là lỗi đầu tiên; cài để pass

## 2. Pre-commit

- [x] 2.1 Viết test cho chọn bản bị phản hồi: cặp cùng phiên có prompt ở giữa (kể cả phiên khác sửa xen giữa, và lần sửa của commit bị huỷ), thử cặp sau khi cặp đầu không dùng được, sửa liên tiếp không prompt, prompt khác phiên, thiếu ảnh chụp, ảnh chụp trùng nội dung stage, chỉ dev xoá dòng, file stage quá lớn; cài trong `src/hooks/git/check-commit.ts` để pass

## 3. Post-commit

- [x] 3.1 Viết test cho `judge`: chỉ `ai-self-fix`, chỉ `manual-fix`, cả hai, chỉ thêm dòng (không lỗi), chỉ khác khoảng trắng (không lỗi), check không khớp HEAD; cài trong `src/hooks/git/attach-commit.ts` để pass

## 4. Report, export, eval, classify

- [x] 4.1 Viết test cho `by_source` trong report (chữ và JSON, bỏ `dismissed`); cài để pass
- [x] 4.2 Viết test cho `source` và `input.feedback` trong export (thứ tự khoá, `id` không đổi); cài để pass
- [x] 4.3 Viết test: `eval` đọc ca có `input.feedback` và không đưa nó vào prompt gửi model
- [x] 4.4 Viết test: prompt phân loại có khối `<feedback>` khi có, đã escape và cắt theo giới hạn; cài trong `src/classify/prompt.ts` để pass

## 5. Kiểm tra đầu cuối

- [x] 5.1 Test e2e với git thật: prompt, AI sửa sai, prompt phản hồi, AI sửa lại, commit → `nightowl failures` báo 1 lỗi, `report` và `export` có `ai-self-fix`
- [x] 5.2 Cập nhật README (cách phát hiện, trường mới của export)
- [x] 5.3 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
