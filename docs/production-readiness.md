# Kế Hoạch Chuẩn Bị Cho Sản Phẩm Production-Ready (Production Readiness Roadmap)

Tài liệu này ghi mức độ sẵn sàng kỹ thuật của **NightOwl Evals** (`@hoanghainh/nightowl-evals`) sau khi hoàn thành lộ trình Production-Ready gốc (1–17) và các vòng ideation **v0.3–v0.5** (ship `0.5.0` / `0.5.1`). Phạm vi vẫn **open-core / local-first**.

Hướng tiếp theo: [`v0.6-roadmap-ideas.md`](v0.6-roadmap-ideas.md). Lịch sử v0.5: [`v0.5-roadmap-ideas.md`](v0.5-roadmap-ideas.md).

---

## 1. Đánh giá mức độ sẵn sàng theo Module (Readiness Matrix)

| Module | Tỷ lệ hoàn thiện | Trạng thái | Đánh giá tóm tắt |
| :--- | :---: | :---: | :--- |
| **1. Core CLI & Lifecycle** | **95%** | Production | Subcommands ổn định; `doctor`, shell completion, help đầy đủ. |
| **2. Setup & Hook Injection** | **90%** | Production | Worktree / `core.hooksPath`; Husky & Lefthook; multi-agent `init`. |
| **3. Ingestion & Hook Capture** | **90%** | Production | Fail-open, timeout; inline secret scan; CI/PR/revert signals. |
| **4. Storage (`node:sqlite`)** | **90%** | Production | WAL, migrations, `prune` / retention; schema hiện hành trên `main`. |
| **5. Classification** | **85%** | Production | Claude CLI + tùy chọn API key; LLM opt-in. |
| **6. Analytics & Review** | **90%** | Production | `report`/`--json`, dashboard, digest, clusters, TUI review, noise estimate. |
| **7. Export & Eval** | **85%** | Production | JSONL + privacy; eval runner; eval A/B compare local. |
| **8. Cross-Platform & CI** | **80%** | Near Production | macOS/Linux vững; Windows process kill đã fix — còn edge path/permission (xem v0.6). |
| **9. Team local surfaces** | **85%** | Production | Customer-report, Action CI gate, workspace-aware modules, rule-impact. |

---

## 2. Khoảng trống còn mở (Remaining Gaps)

Các mục dưới đây **không** còn là gap Production-Ready gốc; chúng là hướng sâu hơn cho giai đoạn team local — chi tiết trong [`v0.6-roadmap-ideas.md`](v0.6-roadmap-ideas.md).

### 2.1. DX máy team / Windows
- Doctor sâu hơn: workspace discovery, độ thật của hook file, readiness tín hiệu/`report`.
- Windows: path normalize, quyền NTFS, edge case còn lại ngoài kill process group.

### 2.2. Tin cậy dữ liệu & vòng rule
- Siết vòng `suggest-rules` → apply → `rule-impact` → digest/dashboard.
- Adapter đa agent còn best-effort: fixture/doctor thật hơn.

### 2.3. Quy mô & monorepo
- `--workspace` MVP chỉ lọc failure; `changedRate` / checks / signals còn full-window (`#45`).
- DB lớn: ngân sách query/index cho report/dashboard (`#47`).
- Prune UX: dry-run dung lượng, retention profiles (`#44`).
- Gói share-out local đã redact, offline (`#46`).

---

## 3. Lộ trình đã hoàn thành (Archive)

```
Đã xong — Production-Ready gốc (P0–P2)
├── fix-cross-platform-process
├── add-inline-secret-filter
├── add-doctor-command
├── add-storage-prune
├── add-hook-manager-support
├── add-report-json
├── add-eval-test-runner
└── add-direct-api-classify

Đã xong — Ideation v0.3 / v0.4 / v0.5 (xem roadmap docs)
├── multi-agent, rules, regressions, TUI, Action, completion, …
├── CI/PR signals, rule-impact, customer-report, …
└── dashboard, noise, clusters, revert, digest, privacy, eval A/B, workspace

Tiếp theo — v0.6 (ideation 40+)
└── docs/v0.6-roadmap-ideas.md
```

### Bảng Change Production-Ready gốc (lịch sử)

| Thứ tự | Tên Change | Nội dung | Mức độ ưu tiên | Trạng thái |
| :---: | :--- | --- | :---: | :---: |
| 1 | `fix-cross-platform-process` | Khắc phục kill process group trên Windows trong `run-claude.ts` | P0 | Hoàn thành |
| 2 | `add-inline-secret-filter` | Bổ sung regex quét secret inline cho snapshot | P0 | Hoàn thành |
| 3 | `add-doctor-command` | Lệnh `nightowl doctor` chẩn đoán cấu hình môi trường | P0 | Hoàn thành |
| 4 | `add-storage-prune` | Cơ chế dọn dẹp snapshot cũ và tối ưu dung lượng SQLite | P1 | Hoàn thành |
| 5 | `add-hook-manager-support` | Hỗ trợ cấu hình tích hợp Husky và Lefthook | P1 | Hoàn thành |
| 6 | `add-report-json` | Thêm cờ `--json` cho `nightowl report` | P1 | Hoàn thành |
| 7 | `add-eval-test-runner` | Hỗ trợ chạy kiểm thử tự động (unit tests) để verify eval | P2 | Hoàn thành |
| 8 | `add-direct-api-classify` | Hỗ trợ gọi phân loại trực tiếp qua LLM API key | P2 | Hoàn thành |
