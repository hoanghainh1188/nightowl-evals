# Proposal

## Why

Doc chốt cách phát hành là `npm publish --access public` cho package `@hoanghainh/nightowl-evals`, nhưng chưa có quy trình nào:
- Package chưa có trên npm (tên còn trống). Người dùng phải clone repo và `npm link`.
- Publish tay từ máy cá nhân dễ sai: quên build, publish bản chưa qua test, version lệch với tag git, và phải để token npm trên máy.
- Không có provenance, nên người cài không kiểm chứng được bản trên npm được build từ đúng mã nguồn trên GitHub.

## What Changes

- **Workflow mới `.github/workflows/release.yml`**, chạy khi push tag `v*` (ví dụ `v0.2.0`):
  1. Kiểm tra tag khớp `version` trong `package.json`, và commit được gắn tag nằm trên `main`. Không khớp thì dừng, không publish gì.
  2. Chạy đủ các bước như CI: typecheck, test kèm coverage, build, kiểm tra spec, `npm pack --dry-run`.
  3. `npm publish --access public` bằng **trusted publishing** (OIDC). Không có token npm nào được lưu trong GitHub hay trên máy. Provenance được tạo tự động.
  4. Tạo **GitHub Release** cho tag, ghi chú tự sinh từ các PR đã merge.
- **Bản thử** (tag có hậu tố, ví dụ `v0.2.0-beta.1`): publish với dist-tag `next` thay vì `latest`, và GitHub Release đánh dấu là pre-release, để `npm i -g @hoanghainh/nightowl-evals` không cài nhầm bản thử.
- **Chạy lại an toàn:** nếu version đó đã có trên npm (ví dụ chạy lại workflow sau khi bước tạo Release lỗi), bỏ qua bước publish và chỉ tạo Release còn thiếu.
- **`package.json`:**
  - thêm `repository`, `homepage`, `bugs` (trusted publishing yêu cầu `repository.url` khớp đúng repo);
  - thêm script `prepack` chạy build, để bản đóng gói luôn được build mới.
- **README** thêm mục "Releasing" ghi các bước phát hành.

Việc bạn làm một lần trên npmjs.com và GitHub, nằm ngoài code:
- Cấu hình trusted publisher cho package trên npmjs.com:
  - owner `hoanghainh1188`;
  - repo `nightowl-evals`;
  - workflow `release.yml`;
  - environment `npm`;
  - bật quyền `npm publish`.
- Tạo environment `npm` trên GitHub. Có thể đặt bạn là người duyệt bắt buộc: khi đó mỗi lần release sẽ chờ bạn bấm duyệt trước khi publish.
- npmjs.com chỉ cho cấu hình trusted publisher khi package đã tồn tại. Vì vậy lần publish đầu tiên (`0.1.0`) **phải làm tay một lần** trên máy bạn, từ `main` sạch (`npm login`, rồi `npm publish --access public`; `prepack` tự build). Sau đó mới cấu hình trusted publisher, và từ lần sau mọi release đều đi qua workflow.

Ngoài phạm vi:
- Tự tăng version hay tự viết CHANGELOG (release-please, changesets).
- Publish lên registry khác (GitHub Packages).
- Ký commit hoặc ký tag.

## Capabilities

### New Capabilities

- `release`: quy trình phát hành lên npm và GitHub Release từ tag git.

### Modified Capabilities

(không có)

## Impact

- File mới: `.github/workflows/release.yml`.
- Sửa: `package.json` (thêm metadata và script `prepack`) và `README.md`.
- Không đổi code của CLI. Không thêm dependency.
- Phát hành là hành động công khai: workflow chỉ chạy khi chính bạn push tag.
