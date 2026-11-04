# Design

## Context

- `ci.yml` chạy trên Node 22.13 và 24: typecheck, test kèm coverage, build, `npm pack --dry-run`, kiểm tra spec. Check `ci` là bắt buộc trên `main`.
- `main` có branch protection: phải qua PR, check `ci` bắt buộc, admin không bị ép. Vì vậy commit tăng version phải đi qua PR.
- Repo public, nên provenance của trusted publishing được tạo tự động.
- Trusted publishing (theo tài liệu npm):
  - cần npm CLI ≥ 11.5.1, Node ≥ 22.14, và quyền `id-token: write`;
  - chỉ chạy trên runner do GitHub cung cấp;
  - `repository.url` trong `package.json` phải khớp repo;
  - cấu hình gồm owner, repo, tên file workflow, environment (tuỳ chọn) và các hành động được phép.

## Goals / Non-Goals

**Goals:**
- Một lệnh `git push` tag là đủ để phát hành, không cần token.
- Không thể publish bản chưa qua test, hay bản có version lệch với tag.

**Non-Goals:**
- Tự động hoá việc chọn version.

## Decisions

### 1. Quy trình phát hành
1. Trên một nhánh mới: `npm version <patch|minor|major> --no-git-tag-version`, commit, mở PR, merge.
2. Trên `main` đã cập nhật: `git tag v<version>`, rồi `git push origin v<version>`.
3. Workflow chạy. Nếu environment `npm` có người duyệt, workflow chờ bạn duyệt rồi mới publish.

Không dùng `npm version` mặc định (nó commit và tag thẳng trên `main`), vì `main` không nhận push trực tiếp.

### 2. Ba job, quyền tách riêng
- **`verify`** chỉ có `contents: read`:
  - kiểm tra tag khớp `version` và commit của tag nằm trên `origin/main` (`git merge-base --is-ancestor`, sau khi checkout với `fetch-depth: 0`);
  - chạy lại đủ các bước của CI trên Node 24 (CI của PR đã chạy cả hai phiên bản trên cùng commit);
  - `npm pack --json` ra file `.tgz` kèm checksum SHA-256, rồi tải lên làm artifact.
- **`publish`** chỉ có `id-token: write` và chạy trong environment `npm`:
  - không checkout, không `npm ci`, không build: không có code nào của package hay của dependency chạy cạnh token OIDC;
  - tải artifact về, kiểm tra checksum, rồi `npm publish <tarball> --ignore-scripts`;
  - nhờ vậy bản được publish chính là bản `verify` đã kiểm tra.
- **`release`** chỉ có `contents: write`: tạo GitHub Release.

### 3. Publish
- Node được ghim đúng phiên bản (`24.22.2`, đi kèm npm 11.19.1), nên lúc publish không phải tải npm. Một bước kiểm tra npm ≥ 11.5.1 bằng `sort --version-sort` để báo lỗi rõ ràng nếu bản ghim bị đổi.
- Version có dấu `-` (bản thử) thì dùng `--tag next`; còn lại dùng `--tag latest`.
- Kiểm tra version đã có: `npm view <name>@<version> version` với `NODE_AUTH_TOKEN` rỗng (file `.npmrc` do `setup-node` tạo chứa một token giả, có thể làm registry trả 401).
  - Thành công: version đã có, bỏ qua publish.
  - Lỗi `E404`: chưa có, nên publish.
  - Lỗi khác (mạng, 401): dừng, không đoán.

### 4. GitHub Release
`gh release view` với `GH_REPO` (không cần checkout). Release đã có thì bỏ qua; nhận "release not found" thì `gh release create "$TAG" --verify-tag --generate-notes`, thêm `--prerelease` cho bản thử; lỗi khác thì dừng.

### 5. An toàn của workflow
- Ghim mọi action theo SHA của commit (kèm comment ghi version).
- `concurrency: release-<tag>`, không huỷ lần đang chạy: mỗi tag chạy riêng, không tag nào bị bỏ khi nhiều tag được push gần nhau.
- Không dùng `${{ }}` trong `run:`; mọi giá trị đi qua biến môi trường.
- `scripts/check-release-tag.ts` chỉ nhận tag đúng chuẩn semver (không số 0 thừa ở đầu, không build metadata), nên không thể chèn dòng vào `GITHUB_OUTPUT`.

### 6. `prepack`
`"prepack": "npm run build"`, nên cả `npm pack` lẫn `npm publish`, chạy tay hay trong CI, luôn đóng gói `dist/` mới nhất.

## Risks / Trade-offs

- [Cấu hình trusted publisher sai: tên file, environment, owner] → npm không kiểm tra lúc lưu cấu hình, chỉ báo lỗi lúc publish. Workflow dừng ở bước publish, không có gì bị publish. Sửa cấu hình rồi chạy lại job.
- [Package phải tồn tại trước mới cấu hình được trusted publisher, nên bản `0.1.0` được publish tay và không có provenance] → Chấp nhận cho bản đầu. README hướng dẫn: chạy từ `main` sạch, sau khi test qua (`npm ci && npm test`), rồi publish. Sau khi cấu hình trusted publisher, nên đặt "Publishing access" của package thành chỉ cho trusted publisher (không cho publish bằng token), để không ai publish tay được nữa.
- [Ai đó có quyền ghi repo push tag] → Chỉ bạn có quyền ghi. Environment `npm` có người duyệt bắt buộc là lớp chặn thứ hai, và một ruleset cho tag `v*` có thể giới hạn ai được tạo tag.
- [Bản vá cho version cũ (ví dụ `0.1.1` sau `0.2.0`) sẽ chiếm dist-tag `latest`] → Hiếm ở giai đoạn này. Khi cần, publish bản đó dưới dạng bản thử, hoặc sửa dist-tag bằng tay sau đó.
