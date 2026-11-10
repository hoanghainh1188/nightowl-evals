# Design

## Context

CLI đăng ký lệnh qua `src/commands/index.ts`; mỗi `Command` có `name`, `summary`, `help`. Roadmap: `nightowl completion <bash|zsh|fish>`. Zero runtime deps. Xem proposal — Why.

## Goals / Non-Goals

**Goals:**
- Một lệnh in script cho 3 shell; data-driven từ registry + bảng flag tĩnh/parse từ help.
- Test được: stdout chứa lệnh/flag; invalid shell fail.

**Non-Goals:**
- Không package riêng cho oh-my-zsh / Homebrew formula.
- Không dynamic completion gọi NightOwl mỗi lần tab (tránh chậm); embed danh sách trong script.
- Không PowerShell v1.

## Decisions

1. **Lệnh `completion` + positional shell**
   - `nightowl completion bash` khớp roadmap.
   - Alternative: `nightowl --completion=bash` — bỏ.

2. **Nguồn data completion**
   - Commands: import `commands` từ index.
   - Flags: module `src/completion/flags.ts` map `commandName → readonly string[]` các `--flag` (và short nếu hữu ích), **chốt:** bảng tĩnh đồng bộ với help (test snapshot/assert mỗi command có entry; CI fail nếu thiếu lệnh mới).
   - Alternative: parse `command.help` — mong manh; bảng tĩnh rõ hơn.

3. **Generator theo shell**
   - `src/completion/{bash,zsh,fish}.ts` hoặc một `render(shell, catalog)`.
   - Bash: `complete -F` + function.
   - Zsh: `#compdef` + `_arguments` / `_describe`.
   - Fish: `complete -c nightowl …`.
   - Catalog: `{ commands: {name, flags[]}[] }`.

4. **Cài đặt user**
   - README: `eval "$(nightowl completion bash)"` / zsh tương tự / fish `nightowl completion fish | source`.
   - Không tự sửa rc files.

5. **Normalize shell**
   - Lowercase; reject khác `bash|zsh|fish`.

## Risks / Trade-offs

- [Bảng flag lệch help] → Test: mọi command trong registry có flags entry; spot-check flag quan trọng.
- [Script dài] → Chấp nhận; generate compact.
- [Bash trên macOS cũ] → Dùng cú pháp phổ biến; document Bash 3.2+.

## Migration Plan

1. Ship `completion` + generators + tests + README.
2. Archive / sync `shell-completion`, `cli`.
3. Tick roadmap 24.

## Open Questions

- Không còn câu hỏi chặn.
