# Kế Hoạch Chuẩn Bị Cho Sản Phẩm Production-Ready (Production Readiness Roadmap)

Tài liệu này ghi mức độ sẵn sàng kỹ thuật của **NightOwl Evals** (`@hoanghainh/nightowl-evals`) sau Production-Ready gốc (1–17) và ideation **v0.3–v0.7 Core** (ship `0.5.0` / `0.5.1` / `0.6.0` / `0.6.1` / `0.7.0`). Phạm vi vẫn **open-core / local-first**.

Hướng tiếp theo: [`v0.7-roadmap-ideas.md`](v0.7-roadmap-ideas.md) Secondary (#52–55). Lịch sử v0.6: [`v0.6-roadmap-ideas.md`](v0.6-roadmap-ideas.md). Lịch sử v0.5: [`v0.5-roadmap-ideas.md`](v0.5-roadmap-ideas.md).

---

## 1. Đánh giá mức độ sẵn sàng theo Module (Readiness Matrix)

| Module | Tỷ lệ hoàn thiện | Trạng thái | Đánh giá tóm tắt |
| :--- | :---: | :---: | :--- |
| **1. Core CLI & Lifecycle** | **95%** | Production | Subcommands ổn định; `doctor`, shell completion, help đầy đủ. |
| **2. Setup & Hook Injection** | **90%** | Production | Worktree / `core.hooksPath`; Husky & Lefthook; multi-agent `init`. |
| **3. Ingestion & Hook Capture** | **90%** | Production | Fail-open, timeout; inline secret scan; CI/PR/revert signals. |
| **4. Storage (`node:sqlite`)** | **90%** | Production | WAL, migrations, `prune` / retention; schema hiện hành trên `main`. |
| **5. Classification** | **90%** | Production | Claude CLI + tùy chọn API key; heuristic offline (`#50`); LLM opt-in. |
| **6. Analytics & Review** | **90%** | Production | `report`/`--json`, dashboard, digest, clusters, TUI review, noise estimate, repeat outcomes (`#48`). |
| **7. Export & Eval** | **90%** | Production | JSONL + privacy; eval runner; eval A/B; project eval loop (`#51`). |
| **8. Cross-Platform & CI** | **90%** | Production | macOS/Linux/Windows path + NTFS best-effort + hook execute-bit skip trên win32 (`#41`). |
| **9. Team local surfaces** | **85%** | Production | Customer-report, Action CI gate, workspace-aware modules, rule-impact. |

---

## 2. Ideation v0.6 đã ship (Remaining Gaps → closed)

Các mục dưới đây **không** còn là gap Production-Ready gốc; chúng là hướng sâu hơn cho giai đoạn team local đã đóng trong `0.6.0` / `0.6.1` — chi tiết trong [`v0.6-roadmap-ideas.md`](v0.6-roadmap-ideas.md).

### 2.1. Đã ship trong `0.6.0` Core
- Doctor team readiness / workspace / authenticity (`#40`).
- Windows local DX: path normalize, NTFS best-effort, hook chmod skip (`#41`).
- Vòng rule local siết hơn (`#42`); adapter best-effort sâu hơn + shape checks (`#43`).

### 2.2. Đã ship trong `0.6.1` Secondary
- Prune UX: dry-run bytes, retention profiles, vacuum size (`#44`).
- `--workspace` scope `changedRate` / path-bearing checks (`#45`).
- Share-pack local offline đã redact (`#46`).
- DB lớn: report-window indexes + doctor/report timing (`#47`).

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

Đã xong — Ideation v0.3 / v0.4 / v0.5 / v0.6 / v0.7 Core (xem roadmap docs)
├── multi-agent, rules, regressions, TUI, Action, completion, …
├── CI/PR signals, rule-impact, customer-report, …
├── dashboard, noise, clusters, revert, digest, privacy, eval A/B, workspace
├── doctor team, Windows DX, rule feedback loop, deeper multi-agent adapters (`0.6.0`)
├── prune UX, workspace metrics, share-pack, large-DB timing (`0.6.1`)
└── repeat outcomes, local config, offline classify, project eval loop (`0.7.0`)

Tiếp theo — v0.7 Secondary (#52–55)
└── docs/v0.7-roadmap-ideas.md
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
