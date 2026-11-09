# Thiết kế: Machine-Readable Outputs & CI/CD Quality Gate (`add-report-json`)

## Kiến trúc & Luồng thực thi

### 1. Mở rộng `nightowl report`

#### Tùy chọn CLI mới
- `--output <path>` (hoặc `-o <path>`): Ghi báo cáo kết quả (văn bản hoặc JSON) ra đường dẫn file chỉ định.
- `--fail-on-rate <0-100>`: Ngưỡng phần trăm lỗi cho phép của code do AI sinh ra bị nhà phát triển sửa đè (`changedRate.rate * 100`).

#### Logic xử lý trong `src/commands/report.ts`
1. **Phân tích tham số (`parseOptions`)**:
   - Sử dụng `parseArgs`:
     ```ts
     output: { type: 'string', short: 'o' },
     'fail-on-rate': { type: 'string' },
     ```
   - Xác thực `--fail-on-rate`: Phải là số hợp lệ từ 0 đến 100. Nếu không, trả về lỗi `--fail-on-rate must be a number from 0 to 100`.
   - Xác thực `--output`: Chuỗi không rỗng.
2. **Thực thi lệnh (`run`)**:
   - Tạo nội dung báo cáo: `const outputContent = options.json ? formatJson(report) : formatText(report);`
   - Xuất ra file nếu có `--output`:
     - Tự động tạo thư mục chứa nếu chưa tồn tại (`mkdir(dirname(options.output), { recursive: true })`).
     - Ghi file qua `deps.writeFile(options.output, outputContent, 'utf8')`.
   - Xuất ra `io.stdout(outputContent)`.
   - Kiểm tra ngưỡng `--fail-on-rate`:
     - Nếu `options.failOnRate !== null` và `report.changedRate.checked > 0` và `report.changedRate.rate !== null`:
       - `const ratePercent = report.changedRate.rate * 100;`
       - Nếu `ratePercent > options.failOnRate`:
         - In thông báo ra stderr: `nightowl report: failure rate (${Math.round(ratePercent)}%) exceeds threshold of ${options.failOnRate}%\n`.
         - Trả về mã thoát `1`.
     - Nếu `checked === 0` hoặc `ratePercent <= options.failOnRate`:
       - Trả về mã thoát `0`.

### 2. Bổ sung cờ `--json` cho `nightowl review`

#### Phân tích tham số trong `src/commands/review.ts`
1. **Kiểu dữ liệu Action**:
   ```ts
   type Action =
     | { readonly kind: 'list'; readonly statuses: readonly FailureStatus[] | null; readonly source: FailureSource | null; readonly limit: number; readonly json: boolean }
     | { readonly kind: 'show'; readonly id: number; readonly json: boolean }
     | { readonly kind: 'mark'; readonly mark: Mark; readonly ids: readonly number[] };
   ```
2. **Hàm `parseList`**:
   - Nhận thêm tùy chọn `json: { type: 'boolean' }`.
   - Trả về `json: values.json === true`.
3. **Hàm `parseAction` với `show`**:
   - Sử dụng `parseArgs` với `options: { json: { type: 'boolean' } }` và `allowPositionals: true`.
   - Kiểm tra `positionals.length === 1`.
   - Trả về `{ kind: 'show', id: parseId(positionals[0]), json: values.json === true }`.

#### Xuất dữ liệu trong `runRead`:
1. **Chế độ `show`**:
   - Nếu `action.json === true`:
     `io.stdout(`${JSON.stringify(failure, null, 2)}\n`);`
   - Nếu không, giữ nguyên định dạng văn bản: `io.stdout(formatDetail(failure));`
2. **Chế độ `list`**:
   - Nếu `action.json === true`:
     `io.stdout(`${JSON.stringify(failures, null, 2)}\n`);`
   - Nếu không, giữ nguyên định dạng bảng: `io.stdout(formatList(failures, ...));`

### 3. Khả năng kiểm thử (Testability & Decoupling)

- Bổ sung `writeFile?: (path: string, content: string) => Promise<void>` vào `ReportDeps` với mặc định sử dụng `node:fs/promises`.
- Viết unit test cô lập kiểm tra việc gọi ghi file, kiểm tra các ngưỡng fail/pass của `--fail-on-rate`, và kiểm tra parse/serialize JSON trong `test/commands/report.test.ts` và `test/commands/review.test.ts`.
