# Proposal

## Why

Trong monorepo, `moduleOf` hiện chỉ lấy `--depth` segment đầu của path (`src/hooks/...` → `src/hooks`), nên nhiều package (`packages/ui`, `apps/web`) bị gộp/sai nhãn. Ideation #39 cần nhận diện package/workspace roots local và lọc `--workspace` để report/dashboard/digest phản ánh đúng ranh giới package — vẫn một DB `.nightowl/` trên máy, không multi-repo sync.

## What Changes

- Thêm **workspace awareness local**: quét cấu hình workspace đã document (`package.json` `workspaces`, `pnpm-workspace.yaml`; có thể đọc `name` từ `package.json` con) trong repo git hiện tại, không gọi mạng.
- Khi gắn nhãn module cho report surfaces, ưu tiên **package/workspace root** (ví dụ `packages/ui` hoặc tên package) thay vì chỉ depth nông; khi không phát hiện workspace/package, **giữ** semantics `--depth` hiện có (không **BREAKING** mặc định).
- Thêm cờ **`--workspace <name>`** (repeatable nếu design chọn) trên các lệnh báo cáo dùng module (`report`, và các surface tương đương: `customer-report` / `dashboard` / `digest` ít nhất) để chỉ gồm failure thuộc workspace khớp.
- Không schema DB mới bắt buộc; không sync multi-repo; không SaaS. README + tick #39 khi archive.

### Out of scope

- Multi-repo / multi-tenant DB, sync cloud, dashboard team hosted.
- Tự động detect mọi hệ sinh thái (Cargo workspace, Go modules, Bazel) trong MVP — chỉ JS/TS workspace configs đã document; khác MAY no-op về depth.
- Đổi công thức chấm điểm eval, hook fail-open, hoặc lưu tên developer.
- Dependency runtime mới (parse YAML workspace bằng Node built-in / parser tối thiểu đã có trong repo nếu có).

## Capabilities

### New Capabilities

- `workspace-awareness`: Phát hiện package/workspace roots local và ánh xạ file path → workspace/module label + filter theo tên.

### Modified Capabilities

- `failure-report`: Module labeling tôn trọng workspace khi có; hỗ trợ `--workspace`.
- `customer-quality-report`: Cùng semantics module/filter khi dùng depth/module.
- `local-dashboard`: HTML module labels + filter workspace.
- `weekly-digest`: Tôn trọng filter workspace nếu digest lọc theo module/path; cờ được chấp nhận.
- `cli`: Help nêu `--workspace` / hành vi module.
- `shell-completion`: Catalog flag mới.

## Impact

- Code: module discovery + `moduleOf`/wrapper; wiring lệnh report surfaces; tests monorepo fixture; README.
- Cluster/rule-impact dùng module path: reuse helper nếu cùng semantics (không đổi DB).
- macOS / Linux / Windows; path separator normalize `/`.
