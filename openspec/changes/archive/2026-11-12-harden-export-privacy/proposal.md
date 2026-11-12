# Proposal

## Why

Khi team xuất eval / gửi `customer-report` / chia sẻ dashboard HTML, path đầy đủ và secret/PII còn sót trong nội dung có thể lọt file mang ra ngoài máy. Hook đã lọc secret khi ghi DB, nhưng **lớp xuất** chưa có profile redaction thống nhất + tuỳ chọn làm thô path + dry-run — đúng ideation #37 sau digest (#36).

## What Changes

- Thêm **profile privacy local** (module dùng chung): quét/che secret mạnh hơn (mở rộng pattern hiện có), che email-like PII trong text xuất, tuỳ chọn **coarsen path** (`src/foo/bar.ts` → `src/**/bar.ts` hoặc tương đương đã document).
- Áp dụng khi xuất/ghi file cho `export` (ưu tiên — có code/prompt), và khi có path/module text trên `customer-report` / `dashboard` / `digest` (ít nhất coarsen path khi bật cờ).
- Cờ đã document (ví dụ `--redact-paths` / `--privacy-dry-run` trên `export`; cờ tương đương hoặc alias trên các lệnh báo cáo nếu cùng profile). Dry-run SHALL liệt kê loại chỗ bị che (secret / email / path) **không** in plaintext secret.
- Mặc định: secret inline trong payload xuất SHALL được redacted hoặc bản ghi bị skip (giữ hành vi skip hiện có hoặc siết thêm — không **BREAKING** silent leak). Coarsen path **opt-in**.
- Không gửi mạng, không telemetry, không LLM. Không schema DB mới. README + tick #37 khi archive.

## Capabilities

### New Capabilities

- `export-privacy`: Profile redaction/privacy thống nhất cho nội dung xuất và báo cáo local (secret, PII nhẹ, path coarsening, dry-run).

### Modified Capabilities

- `eval-export`: Áp dụng profile khi xuất; cờ redact-paths / dry-run; secret mạnh hơn.
- `customer-quality-report`: Không lộ path đầy đủ khi bật coarsen; vẫn không lộ tên developer.
- `local-dashboard`: Module/path trong HTML tôn trọng coarsen khi bật.
- `weekly-digest`: Tôn trọng coarsen khi output có path/module (nếu có).
- `cli`: Help các lệnh liên quan nêu cờ privacy.
- `shell-completion`: Catalog flag privacy mới.

## Impact

- Code: `src/privacy/` (hoặc mở rộng `sensitive.ts` + facade); wiring `export` / formatters report surfaces; tests; README.
- Tái dùng pattern hook; không đổi semantics hook ghi DB trong change này (chỉ lớp xuất/hiển thị).
- Không dependency runtime mới.
