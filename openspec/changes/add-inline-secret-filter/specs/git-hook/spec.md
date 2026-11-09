# Spec Delta

## MODIFIED Requirements

### Requirement: Kiểm tra file AI đã sửa
Khi chạy `nightowl precommit`, với mỗi file staged (thêm mới hoặc sửa) có sự kiện `edit` kèm ảnh chụp chưa được kiểm tra, NightOwl SHALL so nội dung staged với ảnh chụp mới nhất của file đó và lưu một sự kiện nguồn `git`, loại `commit-check`, tham chiếu tới sự kiện `edit` đó. Nếu nội dung staged chứa secret inline, NightOwl SHALL NOT lưu `staged_content` mà đánh dấu `staged_skipped: 'contains_secret'`.

#### Scenario: Dev giữ nguyên code AI
- **WHEN** AI ghi `src/a.ts`, dev stage đúng file đó không sửa gì rồi commit
- **THEN** có một sự kiện `commit-check` cho `src/a.ts` với kết quả `unchanged`

#### Scenario: Dev sửa code AI
- **WHEN** AI ghi `src/a.ts`, dev sửa 3 dòng rồi commit
- **THEN** có một sự kiện `commit-check` cho `src/a.ts` với kết quả `modified`, số dòng thêm và bớt khác 0, và nội dung staged

#### Scenario: File AI không đụng tới
- **WHEN** dev commit `README.md` mà không có sự kiện `edit` nào cho file đó
- **THEN** không có sự kiện `commit-check` nào cho `README.md`

#### Scenario: Git coi file AI viết là đổi tên
- **WHEN** AI ghi `new.ts` gần giống `old.ts`, `old.ts` bị xoá, và git nhận ra cặp này là đổi tên
- **THEN** `new.ts` vẫn được kiểm tra như một file thêm mới

#### Scenario: Staged file chứa secret inline
- **WHEN** file staged có chứa API token hoặc private key
- **THEN** sự kiện `commit-check` có `payload.staged_content: null` và `payload.staged_skipped: "contains_secret"`
