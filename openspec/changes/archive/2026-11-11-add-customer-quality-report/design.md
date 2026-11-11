# Design

## Context

See proposal.md — Why. Hiện trạng:

- `nightowl report` dùng `buildReport` + `formatText` / `formatJson` (stdout kỹ thuật tiếng Anh, bar chart ASCII).
- `openExistingStore` / quy tắc chưa init / ngoài git / schema cũ đã ổn định trên nhiều lệnh đọc.
- Không có template VI–JA hay xuất HTML cho khách.

Ràng buộc: offline; không telemetry; không LLM; không schema mới; stack TS hiện có.

## Goals / Non-Goals

**Goals**

- Lệnh riêng `customer-report` tái sử dụng `buildReport`, render template khách.
- Markdown song ngữ mặc định; HTML tùy chọn self-contained.
- Privacy: strip/không đưa author, email, absolute home paths.

**Non-Goals**

- Đổi semantics / format stdout của `report`.
- PDF, email gửi đi, portal SaaS, i18n đầy đủ mọi locale.
- `--fail-on-rate` trên lệnh khách.
- Dịch runtime qua mạng / LLM.
- Nhúng nội dung failure message đầy đủ (có thể lộ PII); chỉ aggregate metrics.

## Decisions

1. **Lệnh mới thay vì mở rộng `report`**  
   Audience khác (khách vs engineer). Giữ `report` ổn định cho CI/`--fail-on-rate`/`--json`.  
   *Alternative:* `--customer` trên `report` — từ chối vì phình help và lẫn cổng CI với tài liệu khách.

2. **Tái sử dụng `buildReport`**  
   Command parse options → `openExistingStore` → `buildReport({ since, depth, agents, now })` → formatter mới. Không query SQL riêng trừ khi thiếu field (MVP: đủ từ `Report` hiện có).

3. **Template local string constants**  
   Module `src/customer-report/templates.ts` (hoặc `src/report/customer-format.ts`) chứa chuỗi VI/JA cho heading, nhãn chỉ số, câu “chưa có dữ liệu”. Render thuần hàm: `formatCustomerMarkdown(report, lang)`, `formatCustomerHtml(report, lang)`.  
   *Alternative:* file `.md` trên disk đọc lúc runtime — thêm I/O/packaging; constants đủ cho MVP.

4. **`--lang both` = hai section nối tiếp**  
   Cùng số liệu, section VI rồi JA (hoặc ngược lại cố định trong design impl: VI trước). Không cột song song phức tạp trong Markdown.

5. **HTML đơn giản**  
   Một document: `<!DOCTYPE html><html lang=…>` + CSS tối thiểu inline trong `<style>`; escape HTML cho mọi số/label. Không chart thư viện ngoài. `--format html` + `--lang both` → một trang hai section hoặc `lang="vi"` trên section.

6. **Privacy filter**  
   Formatter chỉ nhận `Report` aggregates (đã không có author). Không dump `files[]` nội dung; module labels dùng path tương đối như `report`. Regression test assert không xuất chuỗi author fixture.

7. **Flags**  
   Parse strict như `report`: `--since`, `--depth`, `--agent` (multiple), `--output`/`-o`, `--lang`, `--format`. Không `--json` trên MVP (khách cần tài liệu; engineer dùng `report --json`).

8. **Đăng ký / completion / docs**  
   `commands/index.ts`, help một dòng tiếng Anh ngắn (giống lệnh khác), catalog completion, README mục “Customer quality report” với ví dụ VI–JA + `-o`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Bản dịch JA/VI chưa “đúng ngành” | Template ngắn, dễ sửa constants; không block ship |
| HTML bị XSS nếu label có `<` | Escape mọi giá trị động |
| Trùng logic với `formatText` | Chỉ share `buildReport`; không cố share ASCII bars |
| User nhầm `report` vs `customer-report` | Help + README nêu audience rõ |

## Migration Plan

- Thêm lệnh mới; không migration DB.
- Rollback: gỡ lệnh/đăng ký; không ảnh hưởng store.

## Open Questions

- (không còn — `--json` customer bỏ khỏi MVP; thứ tự section VI→JA cố định.)
