# Spec Delta

## ADDED Requirements

### Requirement: Match/filter path chuẩn hóa separator
Ánh xạ path → workspace và filter `--workspace` SHALL chuẩn hóa separator (`\` → `/`) trên path file relative trước khi so khớp với workspace root. Path `packages\\ui\\src\\a.ts` SHALL khớp workspace `packages/ui` giống `packages/ui/src/a.ts`. Discovery roots vẫn lưu dạng đã normalize `/`.

#### Scenario: File path Windows khớp workspace
- **WHEN** workspace `packages/ui` đã phát hiện và path file là `packages\\ui\\src\\Button.tsx`
- **THEN** nearest workspace là `packages/ui` (hoặc name package tương ứng)
