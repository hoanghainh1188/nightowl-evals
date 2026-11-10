# Design

## Context

`nightowl report` đã có `--json`, `--output`, `--fail-on-rate`, và fail rõ khi thiếu DB. README có ví dụ CI thủ công nhiều bước. `.nightowl/` nằm trong `.gitignore` — checkout sạch không có DB. Spec `cli` cấm binary gọi mạng; Action comment dùng GitHub API là lớp workflow, không phải telemetry NightOwl. Xem proposal — Why.

## Goals / Non-Goals

**Goals:**
- Composite Action một `uses:`: setup Node (nếu cần), cài package, chạy report gate, ghi JSON, optional sticky PR comment.
- Document rõ hợp đồng DB trên runner.
- Zero dependency runtime mới cho CLI; Action chỉ dùng shell + `gh`/`curl` GitHub API hoặc `actions/github-script` ghim SHA nếu cần.

**Non-Goals:**
- Không marketplace Action riêng repo (v1 ship trong monorepo nightowl-evals).
- Không sync/upload DB tự động từ máy dev.
- Không đổi schema / CLI report semantics.
- Không LLM tóm tắt comment.

## Decisions

1. **Vị trí Action: `action/` (composite) tại root package**
   - `action/action.yml` + `action/scripts/` (format comment từ JSON).
   - Consumers: `uses: hoanghainh1188/nightowl-evals/action@vX` (hoặc tag).
   - Alternative: repo `nightowl-evals-action` tách — bỏ v1 để một nguồn version với package.

2. **Cài NightOwl qua npm global trong step**
   - `npm install -g @hoanghainh/nightowl-evals@${version}` sau `actions/setup-node` (Action composite tự `uses: actions/setup-node` ghim SHA, hoặc yêu cầu caller đã setup Node 22+ — **chốt:** Action tự setup Node 22 để one-shot).
   - Alternative: `npx` mỗi lần — OK nhưng chậm hơn; global đủ cho job ephemeral.

3. **Inputs**
   - `fail-on-rate` default `25` (khớp roadmap).
   - `since` optional → truyền `--since` nếu set.
   - `output-path` default `nightowl-report.json`.
   - `working-directory` default `.` (repo root có `.nightowl`).
   - `nightowl-version` default `latest` (docs khuyến nghị ghim semver).
   - `comment-on-pr` default `true` trên PR / `false` có thể force.
   - `github-token` default `${{ github.token }}`.

4. **Sticky comment**
   - Marker HTML comment cố định trong body.
   - List comments của issue/PR → tìm marker → PATCH hoặc POST.
   - Dùng `gh api` (runner có `gh`) hoặc script Node nhỏ đọc JSON + gọi REST; **chốt:** shell + `gh` để tránh thêm file JS build — nếu không có `gh`, fallback `curl` + token.
   - Render markdown: rate %, total failures, by_category top, by_module top (từ JSON report hiện có).

5. **Mã thoát**
   - Step report chạy `nightowl report ... --fail-on-rate ... --output ... --json` (hoặc `--output` không cần `--json` nếu file đủ; CLI: dùng cả hai nếu cần stdout log ngắn — **chốt:** `--output` + không bắt buộc dump stdout JSON lớn; có thể thêm `--json` chỉ khi debug. Prefer: `nightowl report --fail-on-rate N --output PATH` và optional `--since`).
   - Propagate exit code; comment step chạy `if: always()` chỉ khi report đã tạo file (để PR vẫn thấy báo cáo khi gate fail).

6. **Thiếu DB**
   - Preflight `test -f .nightowl/nightowl.db` với message rõ, hoặc để CLI fail — **chốt:** preflight trong Action để message thân thiện hơn stderr CLI.

7. **Tests**
   - Unit/script: format markdown từ fixture JSON report (vitest).
   - Không chạy GitHub API thật trong CI package; optional dry-run flag nội bộ script.
   - Validate `action.yml` cú pháp bằng parse YAML trong test nhẹ.

## Risks / Trade-offs

- [DB không có trên PR checkout] → Docs + preflight; ví dụ restore từ `actions/cache` / artifact mã hóa / self-hosted volume.
- [Comment cần permission] → Document `pull-requests: write`; khi thiếu quyền, log warn và không fail gate nếu report đã pass (hoặc fail soft — **chốt:** comment lỗi → warning, không đổi mã thoát gate trừ khi `comment-on-pr` bắt buộc thành công — v1: warn only).
- [Pin third-party actions] → Ghim SHA `actions/setup-node` như release spec.
- [latest npm bất ổn] → Default latest tiện demo; README khuyến nghị ghim version trùng release NightOwl.

## Migration Plan

1. Ship `action/` + script format + test format + README.
2. Archive / sync spec `github-action`.
3. Tick roadmap change 22 trong `openspec/project.md` / docs ideation.
4. (Tuỳ chọn) tag release sau để consumers `uses: ...@v0.3.x`.

## Open Questions

- Không còn câu hỏi chặn specs/tasks; chi tiết pin SHA exact của `setup-node` lấy lúc apply.
