# Kế Hoạch Chuẩn Bị Cho Sản Phẩm Production-Ready (Production Readiness Roadmap)

Tài liệu này ghi lại kết quả đánh giá kỹ thuật và lộ trình nâng cấp các module của **NightOwl Evals** (`@hoanghainh/nightowl-evals`) từ giai đoạn MVP sang bản phát hành chính thức sẵn sàng cho sản xuất (Production-Ready).

---

## 1. Đánh giá mức độ sẵn sàng theo Module (Readiness Matrix)

| Module | Tỷ lệ hoàn thiện | Trạng thái | Đánh giá tóm tắt |
| :--- | :---: | :---: | :--- |
| **1. Core CLI & Lifecycle** | **85%** | Near Production | Kiến trúc I/O và sub-command sạch sẽ; cần lệnh tự chẩn đoán (`doctor`) và shell completion. |
| **2. Setup & Hook Injection** | **80%** | Near Production | Xử lý worktree, symlink và `core.hooksPath` tốt; cần hỗ trợ hook manager (Husky, Lefthook). |
| **3. Ingestion & Hook Capture Engine** | **85%** | Near Production | Fail-open chuẩn, timeout 2s, thuật toán phân biệt `manual-fix` & `ai-self-fix` thông minh; cần quét inline secrets. |
| **4. Storage Layer (`node:sqlite`)** | **80%** | Near Production | Hỗ trợ WAL, busy retry, migration versioning tốt; cần cơ chế dọn dẹp dung lượng (retention / vacuum). |
| **5. Classification Module** | **75%** | MVP+ | Subprocess Claude cô lập tốt; phụ thuộc CLI cục bộ, cần xử lý rate limit và tùy chọn API key. |
| **6. Analytics & Review** | **85%** | Near Production | Hiển thị terminal trực quan; cần xuất định dạng máy đọc (`--json`) cho CI/CD pipeline. |
| **7. Export & Evaluation Pipeline** | **70%** | MVP | Xuất JSONL chuẩn; cần bổ sung cơ chế chấm điểm bằng test runner thực tế (execution verifier). |
| **8. Cross-Platform & Infrastructure** | **65%** | MVP | Chạy hoàn hảo trên macOS/Linux; cần hoàn thiện xử lý Windows (process killing, permissions, shell). |

---

## 2. Các khoảng trống kỹ thuật trọng yếu (Technical Gaps)

### 2.1. Nền tảng & Hệ điều hành (P0)
- **Windows Process Tree Killing**: `src/classify/run-claude.ts` sử dụng `process.kill(-pid, 'SIGKILL')`. Trên Windows, lệnh này không hợp lệ và gây lỗi. Cần cơ chế kill tương thích đa nền tảng.
- **Quyền thư mục (File Permissions)**: Chế độ `0700` (`chmod`) trong `data-dir.ts` mang tính đặc thù POSIX, cần fallback phù hợp trên Windows NTFS.

### 2.2. Bảo mật & Quyền riêng tư (P0)
- **Inline Secret Scanning**: Hiện tại chỉ loại trừ theo tên file (`.env`, `*.pem`, `credentials.*`). Cần bổ sung bộ lọc regex quét các pattern API token/key phổ biến (AWS, GitHub, Anthropic, OpenAI) ngay trong nội dung diff trước khi lưu vào SQLite.

### 2.3. Vận hành & Quản trị dữ liệu (P1)
- **Lệnh tự chẩn đoán (`nightowl doctor`)**: Kiểm tra phiên bản Node (>=22.13), tình trạng SQLite, PATH của `claude` CLI, tính hợp lệ của git hooks và database health.
- **Data Retention & Vacuum**: Snapshot code tối đa 512KB/lần có thể làm dung lượng SQLite tăng cao. Cần bổ sung lệnh `nightowl prune --days <N>` và cấu hình tự động dọn dẹp snapshot cũ.
- **Hỗ trợ Hook Managers**: Khi phát hiện dự án dùng Husky (`.husky/`) hoặc Lefthook (`lefthook.yml`), cung cấp snippet tích hợp thay vì chỉ dừng lại ở cảnh báo `manual`.

### 2.4. Báo cáo & Đánh giá nâng cao (P1 - P2)
- **Xuất dữ liệu có cấu trúc (`nightowl report --json`)**: Cho phép pipeline CI/CD hoặc các dashboard nội bộ đọc số liệu thống kê lỗi.
- **Execution-based Eval Verifier**: Chạy lại test suite thực tế (ví dụ: `npm test`, `pytest`) trên code do model sinh ra để đo lường độ chính xác khách quan thay vì chỉ so sánh diff/text.

---

## 3. Lộ trình triển khai (Implementation Roadmap)

```
Giai đoạn 1: Ổn định nền tảng (Hardening - P0)
├── Change: fix-cross-platform-process (Tương thích Windows process tree)
├── Change: add-inline-secret-filter (Quét và chặn lưu API keys trong diff)
└── Change: add-doctor-command (Lệnh nightowl doctor kiểm tra môi trường)

Giai đoạn 2: Quản trị dữ liệu & Vận hành (Data Ops - P1)
├── Change: add-storage-prune (Lệnh prune và cơ chế auto retention)
├── Change: add-hook-manager-support (Hỗ trợ cấu hình cho Husky & Lefthook)
└── Change: add-report-json (Xuất báo cáo định dạng JSON)

Giai đoạn 3: Mở rộng đánh giá (Advanced Evals - P2)
├── Change: add-eval-test-runner (Chấm điểm bằng test suite thực tế)
└── Change: add-direct-api-classify (Tùy chọn phân loại trực tiếp qua API)
```

### Chi tiết các Change đề xuất

| Thứ tự | Tên Change | Nội dung | Mức độ ưu tiên | Trạng thái |
| :---: | :--- | --- | :---: | :---: |
| 1 | `fix-cross-platform-process` | Khắc phục kill process group trên Windows trong `run-claude.ts` | P0 | Hoàn thành |
| 2 | `add-inline-secret-filter` | Bổ sung regex quét secret inline cho snapshot | P0 | Hoàn thành |
| 3 | `add-doctor-command` | Lệnh `nightowl doctor` chẩn đoán cấu hình môi trường | P0 | Hoàn thành |
| 4 | `add-storage-prune` | Cơ chế dọn dẹp snapshot cũ và tối ưu dung lượng SQLite | P1 | Hoàn thành |
| 5 | `add-hook-manager-support` | Hỗ trợ cấu hình tích hợp Husky và Lefthook | P1 | Hoàn thành |
| 6 | `add-report-json` | Thêm cờ `--json` cho `nightowl report` | P1 | Hoàn thành |
| 7 | `add-eval-test-runner` | Hỗ trợ chạy kiểm thử tự động (unit tests) để verify eval | P2 | Chưa bắt đầu |
| 8 | `add-direct-api-classify` | Hỗ trợ gọi phân loại trực tiếp qua LLM API key | P2 | Chưa bắt đầu |
