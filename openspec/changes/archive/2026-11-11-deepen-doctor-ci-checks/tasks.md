# Tasks

## 1. Doctor — sẵn sàng report + agent messaging

- [x] 1.1 Khi DB hợp lệ và `failures.total === 0`, doctor phát `warn` (report readiness) + remedy; có failure thì không warn vì lý do đó; verify `test/commands/doctor.test.ts`
- [x] 1.2 Đảm bảo stdout agent checks nêu maturity / thiếu hook rõ (Cursor + AGENT_CONFIGS); bổ sung/siết test nếu thiếu; verify doctor tests agent section

## 2. Action preflight + empty data warning

- [x] 2.1 Giữ fail khi thiếu `nightowl.db`; làm rõ message restore (cache/artifact/self-hosted + gitignore); verify action test hoặc script assertion nếu có
- [x] 2.2 Khi DB tồn tại: phát `::warning::` nếu report JSON `total === 0` (preflight nhẹ hoặc tái dùng output); không fail gate chỉ vì 0 failure; verify test/fixture Action nếu có, hoặc kiểm tra bước trong `action/action.yml` + test liên quan

## 3. Docs

- [x] 3.1 README: thay placeholder bằng ví dụ YAML restore cụ thể (`download-artifact` và/hoặc `cache`) trước `uses:` gate; verify chuỗi docs khớp help/Action notes
