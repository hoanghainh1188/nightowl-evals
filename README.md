# NightOwl Evals

Record every time AI writes wrong code, and turn those failures into an eval suite for your own project. Local-first.

When Claude Code writes buggy code and you fix it—either by hand before committing or by prompting the AI to correct itself—that fix usually disappears, and the AI repeats the mistake later. NightOwl captures the failure automatically at commit time, keeps the AI version and your corrected version side by side, and lets you:

- see where the AI goes wrong, by type, source, module and week (`nightowl report`);
- export each failure as an evaluation dataset (`nightowl export`);
- re-run those cases against Claude models and compare scores (`nightowl eval`).

**Everything stays on your machine by default.** Data lives in `.nightowl/` inside your repository (git-ignored, mode `0700`). Nothing is sent anywhere unless you run `classify` or `eval` with `--yes` (local `claude` CLI by default, or Anthropic API when `classify --transport api`).

```
┌──────────────────┐
│ Claude Code Edit │ ──> Claude hook (PostToolUse) ──> nightowl log ──> Snapshots in SQLite
└──────────────────┘                                                           │
         │                                                                     │
 [Dev Fixes Code                                                               │
  or Prompts AI to Self-Fix]                                                   │
         │                                                                     ▼
         ▼
┌──────────────────┐
│   git commit     │ ──> pre-commit hook  ──> Compares staged files with AI snapshot
└──────────────────┘ ──> post-commit hook ──> If code changed: records Failure (manual-fix / ai-self-fix)
                                                               │
                           ┌───────────────────────────────────┴───────────────────────────────────┐
                           ▼                                                                       ▼
                 nightowl report                                                            nightowl export
         (Failure trends & error rates)                                            (Standard JSONL test cases)
                                                                                                   │
                                                                                                   ▼
                                                                                            nightowl eval
                                                                                   (Benchmark Claude models)
```

## Requirements

- Node.js 22.13 or newer
- git
- [Claude Code](https://docs.claude.com/claude-code) — the AI whose edits are recorded, and the `claude` CLI used by `classify` and `eval`

## Install

```bash
npm i -g @hoanghainh/nightowl-evals
```

From source:

```bash
git clone https://github.com/hoanghainh1188/nightowl-evals.git
cd nightowl-evals
npm install
npm run build
npm link
```

> **Note:** `nightowl` must be on your `PATH`. The hooks call it by name and quietly do nothing if it is missing.

## Quick start

In any repository you work on with Claude Code:

```bash
nightowl init
```

This adds, without modifying existing settings or hooks:

| File | What it does |
| --- | --- |
| `.claude/settings.local.json` | Claude Code hooks that run `nightowl log` after each prompt and file edit (personal to your machine) |
| `.git/hooks/pre-commit` | Runs `nightowl precommit`: compares staged files with what the AI last wrote |
| `.git/hooks/post-commit` | Runs `nightowl postcommit`: records a failure when the committed file differs from the AI version |
| `.gitignore` | Adds `.nightowl/`, and `.claude/settings.local.json` if git does not ignore it yet |

The hooks go in your personal settings by default, so teammates who share the repository are not affected. If your team agrees to record together, use `nightowl init --shared` to place them in `.claude/settings.json` instead.

Then work as usual: prompt Claude Code, fix what it got wrong, commit. Check what has been collected:

```bash
nightowl failures
nightowl report
```

The hooks never block Claude Code or a commit: they always exit 0, print nothing, and give up after 2 seconds.

## How a failure is detected

1. After Claude Code edits a file, NightOwl stores a snapshot of what the AI wrote.
2. At `git commit`, the pre-commit hook compares the latest AI snapshot of each staged file with the staged content.
3. After the commit, the post-commit hook keeps only comparisons that match the committed file. If you changed the AI's lines (not just whitespace), it records a **failure**: the prompt, the AI version, your final version, and the commit hash.

Failures have a **source**:

- `manual-fix`: you edited the AI's code yourself before committing.
- `ai-self-fix`: you told the AI it was wrong and it redid the edit. NightOwl detects an AI edit, followed by a prompt from you in the same Claude Code session, followed by another AI edit of the same file. If the AI then dropped or changed lines of the edit you responded to (not just whitespace), that edit is recorded as a failure, and your prompt is preserved as its feedback (`input.feedback`). If your prompt only asked the AI to add code without altering existing lines (e.g., adding a feature), nothing is recorded.

Sensitive files (`.env`, keys, tokens, credentials) are automatically ignored and their contents are never stored.

## Commands

Run `nightowl <command> --help` (or `nightowl help <command>`) for any command's options.

### `nightowl init`

Sets up NightOwl hooks and database in the current project. Safe to run multiple times (idempotent).

```bash
nightowl init [--shared]
```

| Option | Meaning |
| --- | --- |
| `--shared` | Put Claude Code hooks in `.claude/settings.json` (shared with team) instead of `.claude/settings.local.json` |

### `nightowl report`

Summarizes recorded failures grouped by category, source, module and ISO week, plus the percentage of AI edits that had to be changed.

```bash
nightowl report [--since <YYYY-MM-DD>] [--depth <1-5>] [--json]
```

| Option | Meaning |
| --- | --- |
| `--since <YYYY-MM-DD>` | Only failures from this date on |
| `--depth <1-5>` | How many folder levels make up a module (default: 2) |
| `--json` | Print output as JSON |

Example report:

```text
NightOwl report: 12 failures (3 unclassified, 0 dismissed not counted)
AI edits changed by the developer: 12 of 48 checked at commit (25%)

By category
  logic                  5  ██████████████████████████████
  convention             2  ████████████
  misread-requirement    1  ██████
  missing-context        1  ██████
  unclassified           3  ██████████████████

By source
  manual-fix             8  ██████████████████████████████
  ai-self-fix            4  ███████████████

By module (top 2 of 2, depth 2)
  src/storage            7  ██████████████████████████████
  src/hooks              5  █████████████████████

By week (last 2, UTC; % = AI edits changed)
  2026-W44               4  ███████████████ 20%
  2026-W45               8  ██████████████████████████████ 28%
```

### `nightowl review`

Look at what was recorded and sort real AI mistakes from noise (for example, you simply changed your mind). Nothing is sent anywhere.

| Command | Meaning |
| --- | --- |
| `nightowl review` | Failures still to look at, newest first: id, date, source, category, file, lines `+added -removed`, start of the prompt |
| `nightowl review show <id>` | One failure: prompt, feedback, classification and the diff from the AI version to the final one |
| `nightowl review confirm <id...>` | Mark as a real AI mistake |
| `nightowl review dismiss <id...>` | Mark as noise; left out of `report` and `export` |
| `nightowl review reset <id...>` | Back to flagged |

Ids can be written `12` or `#12`. If one id does not exist, nothing is changed. `review` (list) takes `--status flagged|confirmed|dismissed|all`, `--source manual-fix|ai-self-fix` and `--limit <1-200>`; `nightowl report` shows how many failures are still flagged.

### `nightowl export`

Exports failures as a test suite (`nightowl.eval/v1` format) to `.nightowl/export/evals.jsonl` (mode 0600, readable only by you). Each JSON line includes the prompt, the file before edit, the AI version (`rejected`), your version (`expected`), the `source`, and any correction prompt (`input.feedback`).

```bash
nightowl export [--out <file>] [--force] [--since <YYYY-MM-DD>] [--category <name>]
```

| Option | Meaning |
| --- | --- |
| `--out <file>` | Output file path (`-` for stdout; default: `.nightowl/export/evals.jsonl`) |
| `--force` | Overwrite target file even if it was not created by NightOwl |
| `--since <YYYY-MM-DD>` | Only export failures from this date on |
| `--category <name>` | Filter by category (`logic`, `convention`, `misread-requirement`, `missing-context`, `unclassified`); repeatable |

### `nightowl classify` (opt-in)

Uses Claude to classify failures into 4 categories: `logic`, `convention`, `misread-requirement`, `missing-context`.

Runs locally via `claude -p` in an isolated temporary directory with all tools and MCP disabled. Without `--yes`, it only previews how many failures would be processed. Only one `classify --yes` runs at a time in a project (`.nightowl/classify.lock`), so failures are never sent twice.

```bash
nightowl classify [--yes] [--transport cli|api] [--model <name>] [--limit <1-100>] [--redo]
```

| Option | Meaning |
| --- | --- |
| `--yes` | Actually execute calls to Claude |
| `--transport cli\|api` | `cli` (default) uses local `claude`; `api` calls Anthropic Messages API (`ANTHROPIC_API_KEY` required with `--yes`) |
| `--limit <1-100>` | Maximum failures to classify in one run (default: 20) |
| `--model <name>` | Claude model to use (default: `haiku`); with `--transport api`, short names map to pinned API model ids |
| `--redo` | Re-classify failures that already have a category |

### `nightowl eval` (opt-in)

Feeds each exported test case back to Claude models to benchmark whether new model versions or system rules solve the defect.

```bash
nightowl eval [--yes] [--input <file>] [--model <name>] [--limit <1-100>] \
  [--test-command <cmd>] [--test-timeout <1-600>] [--require-tests]
```

| Option | Meaning |
| --- | --- |
| `--yes` | Actually execute evaluation calls |
| `--input <file>` | Test suite file to evaluate (default: `.nightowl/export/evals.jsonl`) |
| `--model <name>` | Models to test; repeatable (default: `haiku` and `sonnet`) |
| `--limit <1-100>` | Maximum cases to evaluate (default: 20) |
| `--test-command <cmd>` | After each answer, write it into the case file, run this shell command in the project root, then restore the file |
| `--test-timeout <1-600>` | Seconds before the test command is killed (default: 120) |
| `--require-tests` | Count as pass only when the textual score passes **and** the test command exits 0 (needs `--test-command`) |

**Scoring metrics:**
- **coverage**: share of your intended changes that the model reproduced.
- **repeat**: share of the defective AI code that the model repeated.
- **score** = `coverage × (1 − repeat)`. A score ≥ 0.5 is considered passing (unless `--require-tests` also demands a green test command).

Results and detailed metrics are saved to `.nightowl/runs/<timestamp>.jsonl`.

### Utility commands

| Command | Meaning |
| --- | --- |
| `nightowl failures` | Print failure count summary by status |
| `nightowl uninstall` | Safely remove NightOwl git and Claude Code hooks (leaves `.nightowl/` database intact) |
| `nightowl --help`, `-h` | Display general help |
| `nightowl --version`, `-v` | Display version |

## Data & Privacy

| Path | Purpose |
| --- | --- |
| `.nightowl/nightowl.db` | Local SQLite database (schema migrations, events, snapshots, failures) |
| `.nightowl/export/` | Exported evaluation JSONL datasets |
| `.nightowl/runs/` | Benchmark run logs and scores |

NightOwl is built with strict privacy guarantees:
- **0 Telemetry / 0 Network Calls**: No data is sent to external servers.
- **File Permissions**: `.nightowl/` directory is created with `0700` permissions; exports and eval runs are created with `0600`.
- **Sensitive Content Blacklist**: Automatically blocks `.env`, secret keys, credentials, and tokens from being stored.
- **Opt-in LLM Calls**: `classify` and `eval` will never call Claude CLI without explicit `--yes`.

## Development

```bash
npm run typecheck       # Run TypeScript compiler checks
npm test                # Run Vitest test suite (560+ tests)
npm run test:coverage   # Run tests with V8 code coverage
npm run spec:validate   # Validate OpenSpec specifications
npm run build           # Bundle CLI binary using tsup
```

All features and requirements follow [OpenSpec](https://github.com/Fission-AI/OpenSpec). Current specifications live in [`openspec/specs/`](openspec/specs/).

## License

[Apache-2.0](LICENSE) — Copyright 2026 Hoang Hai
