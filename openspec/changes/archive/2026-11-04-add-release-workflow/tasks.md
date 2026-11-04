# Tasks

## 1. Package

- [x] 1.1 Thêm `repository` (`git+https://github.com/hoanghainh1188/nightowl-evals.git`), `homepage`, `bugs` và script `prepack` vào `package.json`; viết test kiểm tra các trường này và rằng `npm pack --dry-run` chứa `dist/bin.js`, `LICENSE`, `NOTICE`, `README.md`

## 2. Workflow

- [x] 2.1 Viết `.github/workflows/release.yml` theo design: job `verify` (kiểm tra tag, main, CI đầy đủ trên Node 24) và job `publish` (environment `npm`, trusted publishing, dist-tag, bỏ qua khi đã publish, GitHub Release)
- [x] 2.2 Viết test đọc file workflow: chạy trên tag `v*`, quyền mặc định là `contents: read`, chỉ job publish có `id-token: write`, action ghim SHA, có bước so tag với version, kiểm tra main, không dùng `NPM_TOKEN`
- [x] 2.3 Tách phần kiểm tra tag và version thành script `scripts/check-release-tag.ts` (TypeScript chỉ dùng cú pháp xoá được, chạy thẳng bằng Node) để test được; viết test các trường hợp khớp, lệch, bản thử, tag sai dạng

## 3. Tài liệu và kiểm tra

- [x] 3.1 README: mục "Releasing" (lần publish đầu làm tay, cấu hình trusted publisher và environment `npm` sau khi package đã có, khoá publish bằng token, các bước cho mỗi release)
- [x] 3.2 Kiểm tra cú pháp workflow bằng `actionlint` nếu có sẵn trên máy
- [x] 3.3 Chạy `npm run test:coverage` đạt ≥ 80% và `npm run spec:validate`
