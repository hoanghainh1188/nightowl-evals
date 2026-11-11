# NightOwl Evals 🦉

[![npm version](https://img.shields.io/npm/v/@hoanghainh/nightowl-evals.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@hoanghainh/nightowl-evals)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.13-brightgreen.svg?style=flat-square)](https://nodejs.org/)
[![Runtime Dependencies](https://img.shields.io/badge/dependencies-0-success.svg?style=flat-square)](package.json)
[![Coverage](https://img.shields.io/badge/coverage-%3E95%25-brightgreen.svg?style=flat-square)](package.json)
[![OpenSpec Verified](https://img.shields.io/badge/spec-OpenSpec-purple.svg?style=flat-square)](openspec/project.md)

**Turn AI coding mistakes into a tailored, project-specific evaluation test suite. 100% local-first, zero telemetry, zero runtime dependencies.**

---

## Table of Contents

- [Why NightOwl?](#why-nightowl)
- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quickstart (30-Second Tour)](#quickstart-30-second-tour)
- [CLI Reference](#cli-reference)
  - [Setup & Diagnostics](#1-setup--diagnostics)
    - [`nightowl init`](#nightowl-init)
    - [`nightowl doctor`](#nightowl-doctor)
    - [`nightowl uninstall`](#nightowl-uninstall)
  - [Analytics, Review & Data Ops](#2-analytics-review--data-ops)
    - [`nightowl report`](#nightowl-report)
    - [`nightowl customer-report`](#nightowl-customer-report)
    - [`nightowl ingest-ci`](#nightowl-ingest-ci)
    - [`nightowl ingest-pr`](#nightowl-ingest-pr)
    - [`nightowl review`](#nightowl-review)
    - [`nightowl prune`](#nightowl-prune)
    - [`nightowl failures`](#nightowl-failures)
    - [`nightowl suggest-rules`](#nightowl-suggest-rules)
    - [`nightowl suggest-regressions`](#nightowl-suggest-regressions)
    - [`nightowl rule-impact`](#nightowl-rule-impact)
  - [Evaluation & Benchmarking Engine](#3-evaluation--benchmarking-engine)
    - [`nightowl classify`](#nightowl-classify-opt-in)
    - [`nightowl export`](#nightowl-export)
    - [`nightowl eval`](#nightowl-eval-opt-in)
  - [Shell completion](#4-shell-completion)
    - [`nightowl completion`](#nightowl-completion)
- [CI/CD Quality Gate Integration](#cicd-quality-gate-integration)
- [Security & Privacy Guarantees](#security--privacy-guarantees)
- [Development & Contributing](#development--contributing)
- [License](#license)

---

## Why NightOwl?

When an AI assistant (like Claude Code) writes defective code and you fix it—either by hand before committing or by prompting the AI to self-correct—**that critical feedback usually vanishes forever**. The AI will inevitably repeat the exact same mistake next week on the same codebase.

Generic benchmarks (like HumanEval or SWE-bench) evaluate AI on standardized algorithmic puzzles. They do **not** reflect:
- Your team's architectural conventions and idiomatic code patterns.
- Subtle edge cases specific to your domain logic.
- The recurring blind spots where AI constantly fails in your codebase.

**NightOwl silently captures every AI mistake at commit time**, links the defective code with your verified solution, and turns those mistakes into a permanent, regression-proof evaluation benchmark tailored specifically to your project.

---

## How It Works

```
┌────────────────────────┐
│ Claude Code Tool Usage │ ──> Claude hook (PostToolUse) ──> nightowl log ──> Snapshots in SQLite
└────────────────────────┘                                                              │
            │                                                                           │
   [Developer Fixes Code                                                                │
 or Prompts AI to Self-Fix]                                                             │
            │                                                                           │
            ▼                                                                           ▼
┌────────────────────────┐
│       git commit       │ ──> pre-commit hook  ──> Compares staged changes with AI snapshot
└────────────────────────┘ ──> post-commit hook ──> If code was altered: records Failure
                                                                │
                                ┌───────────────────────────────┴───────────────────────────────┐
                                ▼                                                               ▼
                         nightowl report                                                 nightowl export
                  (Trend analytics & CI Gate)                                      (Standard JSONL test cases)
                                │                                                               │
                                ▼                                                               ▼
                         nightowl review                                                  nightowl eval
                     (Inspect & triage diffs)                                      (Benchmark models via tests)
```

1. **Snapshot on Edit**: Whenever Claude Code edits or creates a file, NightOwl creates a lightweight local snapshot.
2. **Detection at Commit**: At `git commit`, the pre-commit hook compares the staged files against the AI snapshot.
3. **Failure Classification**: If you modified the AI's code (or prompted the AI to self-correct a bug), NightOwl records the prompt, the buggy AI code (`rejected`), and your final verified code (`expected`).
4. **Benchmark & Defend**: Export the failures into standard evaluation datasets and benchmark future models or prompt instructions.

---

## Key Features

- 🛡️ **100% Local-First & Zero Telemetry**: All data stays in your local `.nightowl/` directory (mode `0700`). Zero analytics, zero hidden network pings.
- ⚡ **Fail-Open & Frictionless**: Hooks are strictly capped to a 2-second budget and always exit `0`. They will **never** block a developer commit or freeze Claude Code.
- 📦 **Zero Dependencies**: Engineered with pure Node.js built-ins (`node:sqlite`, `node:util`, `node:fs`, `node:crypto`). Nothing to download, audit, or break.
- 🔒 **Inline Secret Protection**: Automatically detects and blocks API keys (AWS, GitHub, OpenAI, Anthropic, private keys) and credentials from entering snapshots.
- 🚦 **CI/CD Quality Gates**: Built-in `--fail-on-rate` option to enforce quality standards in continuous integration pipelines.
- 🧩 **Hook Manager Friendly**: Automatic configuration detection for **Husky** (`.husky/`) and **Lefthook** (`lefthook.yml`).
- 🧪 **Execution-Based Evals**: Benchmark models not just with textual diff metrics, but by running real project test suites (`--test-command`).

---

## Requirements

- **Node.js**: `22.13.0` or newer (uses native `node:sqlite`)
- **Git**: `2.20` or newer
- **Claude Code** (or another supported agent): Optional for capture; Claude Code CLI is required for local `classify` and `eval`

### Supported agents

| Agent | Id | Maturity | Capture / setup |
|-------|----|----------|-----------------|
| Claude Code | `claude-code` | **verified** | `.claude/settings(.local).json` hooks via `nightowl init` |
| Cursor | `cursor` | **verified** | `.cursor/hooks.json` (`beforeSubmitPrompt`, `afterFileEdit`) |
| Windsurf | `windsurf` | **best-effort** | `.windsurf/hooks.json` NightOwl hook entries (tool may need matching Cascade hook support) |
| Cline | `cline` | **best-effort** | `.cline/nightowl.json` project marker + pipe events to `nightowl log --agent cline` |
| Roo Code | `roo` | **best-effort** | `.roo/nightowl.json` project marker + pipe events to `nightowl log --agent roo` |
| Copilot Workspace | `copilot-workspace` | **manual** | No native project hook file from `init`. Wrap: `echo '<json>' \| nightowl log --agent copilot-workspace` |
| Aider | `aider` | **manual** | No native project hook file from `init`. Wrap after edits: `nightowl log --agent aider` with JSON on stdin |

**Maturity:** `verified` = NightOwl installs hooks the tool reads and adapters have fixtures; `best-effort` = install + parse documented but the IDE may need extra setup; `manual` = document-only wrap around `nightowl log` (init does not invent a fake native hook).

**Git fallback:** if a commit changes a file with no recent agent snapshot, NightOwl records an `unattributed-change` observation (optionally inferring the agent from branch names like `cursor/...`). It does **not** invent `ai_content` or create a full failure pair without a real snapshot.

---

## Installation

Install globally via npm:

```bash
npm install -g @hoanghainh/nightowl-evals
```

Or run directly with `npx`:

```bash
npx @hoanghainh/nightowl-evals doctor
```

From source:

```bash
git clone https://github.com/hoanghainh1188/nightowl-evals.git
cd nightowl-evals
npm install
npm run build
npm link
```

---

## Quickstart (30-Second Tour)

### 1. Initialize NightOwl in your Git repo

```bash
cd your-project
nightowl init
```

*This non-destructively injects agent hooks (Claude Code, Cursor, and other supported tools) plus Git hooks without modifying existing workflows. Use `--agents cursor,claude-code` to install a subset.*

### 2. Verify environment health

```bash
nightowl doctor
```

```text
NightOwl Doctor: 5 checks
  ✓ runtime: Node.js v24.13.0 with node:sqlite
  ✓ git: repository at /Users/dev/your-project
  ✓ claude: hooks configured in personal settings (.claude/settings.local.json)
  ✓ hooks: pre-commit and post-commit hooks installed
  ✓ database: .nightowl/nightowl.db schema version 4 integrity ok
Ready to record AI edits.
```

### 3. Code normally with Claude Code & Commit

Prompt Claude Code to write a feature. If it makes a mistake:
- **Case A (Manual fix)**: You edit the code to fix the logic, then run `git commit`.
- **Case B (AI self-fix)**: You prompt Claude *"That function has an off-by-one bug"*, Claude fixes it, then you commit.

### 4. View your analytics

```bash
nightowl report
```

```text
NightOwl report: 6 failures (1 unclassified, 0 dismissed not counted)
AI edits changed by the developer: 6 of 24 checked at commit (25%)
Reviewed: 2 confirmed, 0 dismissed, 4 still flagged (nightowl review)

By category
  logic                  3  ██████████████████████████████
  convention             1  ██████████
  misread-requirement    1  ██████████
  unclassified           1  ██████████

By source
  manual-fix             4  ██████████████████████████████
  ai-self-fix            2  ███████████████

By module (top 2 of 2, depth 2)
  src/services           4  ██████████████████████████████
  src/utils              2  ███████████████

By week (last 2, UTC; % = AI edits changed)
  2026-W44               2  ███████████████ 18%
  2026-W45               4  ██████████████████████████████ 28%
```

---

## CLI Reference

Run `nightowl <command> --help` for options on any command.

### 1. Setup & Diagnostics

#### `nightowl init`

Sets up NightOwl hooks and creates the local SQLite database. Safe to run multiple times (idempotent).

```bash
nightowl init [--shared] [--agents <list>]
```

- `--shared`: Places Claude Code hooks in `.claude/settings.json` (tracked in git for the whole team) instead of `.claude/settings.local.json`.
- `--agents <list>`: Comma-separated agent ids to install (default: all). Example: `nightowl init --agents cursor,claude-code`.
- Automatically detects **Husky** (`.husky/`) or **Lefthook** (`lefthook.yml`) and displays copy-paste integration snippets without overriding files.

#### `nightowl doctor`

Diagnoses local environment prerequisites and validates hook installations.

```bash
nightowl doctor [--strict] [--json]
```

- `--strict`: Exits with code `1` if any warnings or missing hooks are detected.
- `--json`: Outputs diagnostic status as a machine-readable JSON structure.
- Warns (**Report readiness**) when the DB is healthy but has no non-dismissed failures yet — `report`/CI gate will have little signal; with `--strict` that warning also exits `1`.

#### `nightowl uninstall`

Cleanly removes Git hooks and NightOwl agent hook configurations (Claude Code, Cursor, and the other supported agents). Leaves `.nightowl/` database and historical records intact.

```bash
nightowl uninstall [--purge]
```

- `--purge`: Additionally deletes the `.nightowl/` directory and all local history.

---

### 2. Analytics, Review & Data Ops

#### `nightowl report`

Summarizes AI failures by category, source, agent, module path, and week. JSON includes `by_agent`, `head_to_head` (edit-change rate per agent), and `signals` (`ci_fail` / `pr_review` event counts — separate from failure `total`).

```bash
nightowl report [options]
```

| Option | Description |
| :--- | :--- |
| `--since <YYYY-MM-DD>` | Filter records created from this date forward |
| `--depth <1-5>` | Number of folder levels that make up a module (default: `2`) |
| `--agent <id>` | Only include this agent (repeatable) |
| `--json` | Output full breakdown as structured JSON |
| `-o, --output <file>` | Write report directly to a file (creates parent directories) |
| `--fail-on-rate <0-100>` | **CI Quality Gate**: Exit with code `1` if failure rate exceeds threshold |

#### `nightowl customer-report`

Exports a **customer-facing** AI quality report (bilingual Vietnamese–Japanese by default) as Markdown or simple HTML. Uses the same local metrics as `report`, but with offline VI–JA templates and **no developer names/emails**. Not a CI gate — keep using `nightowl report --fail-on-rate` for that.

```bash
nightowl customer-report
nightowl customer-report --lang ja --format html -o dist/ai-quality.html
nightowl customer-report --since 2026-11-01 --agent claude-code -o report.md
```

| Option | Description |
| :--- | :--- |
| `--lang <vi\|ja\|both>` | Report language (default: `both`) |
| `--format <md\|html>` | Output format (default: `md`) |
| `--since <YYYY-MM-DD>` | Filter records created from this date forward |
| `--depth <1-5>` | Module folder depth (default: `2`) |
| `--agent <id>` | Only include this agent (repeatable) |
| `-o, --output <file>` | Write report to a file (creates parent directories; does not dump the full body to stdout) |

#### `nightowl ingest-ci`

Reads a **local** JUnit XML or JSON summary and stores `ci-fail` events. Does **not** invent `failures.ai_content` and does not call the network. Requires an existing DB (`nightowl init`).

```bash
nightowl ingest-ci --file <path> [--format auto|junit|json] [--commit <sha>]
```

**JSON summary schema** (minimal):

```json
{
  "failures": [
    { "file": "src/a.ts", "message": "expected true", "name": "test name", "commit": "abc123" }
  ]
}
```

#### `nightowl ingest-pr`

Reads a **local** JSON file of PR review comments into `pr-review` events (default: offline). Does **not** invent `failures.ai_content`. GitHub API fetch is **opt-in only** via `--github` + `GITHUB_TOKEN` (+ `GITHUB_REPOSITORY` and `--pr`).

```bash
nightowl ingest-pr --file comments.json
nightowl ingest-pr --github --pr 42   # requires GITHUB_TOKEN and GITHUB_REPOSITORY
```

**Local comments schema** (array or `{ "comments": [...] }`):

```json
[
  { "id": "1", "path": "src/a.ts", "body": "nit: rename", "line": 10, "commit_id": "abc", "user": "reviewer" }
]
```

#### `nightowl review`

Interactive triage tool to review recorded failures and distinguish genuine AI bugs from intentional developer changes.

```bash
# List unreviewed failures (flagged)
nightowl review [--status flagged|confirmed|dismissed|all] [--source manual-fix|ai-self-fix] [--agent <id>] [--limit N] [--json]

# Interactive TUI (TTY only)
nightowl review -i [--status ...] [--source ...] [--agent <id>] [--limit N]

# Inspect full details and unified diff of a failure
nightowl review show <id> [--json]

# Mark status
nightowl review confirm <id...>
nightowl review dismiss <id...>
nightowl review reset <id...>
```

- `-i` / `--interactive`: Keyboard triage in the terminal (`↑`/`↓`, Space/Enter for diff, `c`/`d`/`r`, `q` to quit). Requires a TTY; cannot combine with `--json`.
- `--json`: Prints the list or detailed failure object (including unified diff) as JSON.
- `confirm`: Marks failure as an authentic AI mistake.
- `dismiss`: Marks failure as false positive/noise (excluded from reports and evaluation datasets).

#### `nightowl prune`

Cleans up old file snapshots to keep database size optimal while preserving permanent failure records.

```bash
nightowl prune [--days <N>] [--dry-run] [--vacuum]
```

- `--days <N>`: Prune snapshots older than `N` days (default: `30`).
- `--dry-run`: Preview how many records would be deleted without changing anything.
- `--vacuum`: Run SQLite `VACUUM` to reclaim disk space after pruning.

#### `nightowl failures`

Quick terminal summary of total failures grouped by status (`flagged`, `confirmed`, `dismissed`).

#### `nightowl suggest-rules`

Turns repeated classified failures into Markdown rule drafts. Heuristic by default (offline); LLM rewrite only with `--yes`.

```bash
nightowl suggest-rules [--since <YYYY-MM-DD>] [--category <name>] [--agent <id>] \
  [--status <name>] [--min-count <n>] [--limit <n>] \
  [--output <file> | --write <file>] [--force] [--yes] [--transport cli|api] [--model <name>]
```

- Defaults: status `confirmed`, categories `convention` + `missing-context`, clusters with at least 2 failures.
- Default prints to stdout only (does not edit project rule files).
- `--output <file>` writes a **standalone** NightOwl suggestion file wrapped in `<!-- nightowl-suggested-rules:start -->` … `<!-- nightowl-suggested-rules:end -->`.
- `--write <file>` **inserts or updates** that same marker block inside a project rules file (e.g. `CLAUDE.md`, `.cursorrules`) without changing text outside the block. Re-running is idempotent.
- **BREAKING:** `--write` is no longer an alias for `--output`. Use `--output` for a separate suggestion file.
- `--force` with `--output` overwrites a non-NightOwl file; with `--write` it only recovers skewed NightOwl markers when a safe boundary still exists (never blanking the whole rules file).

#### `nightowl suggest-regressions`

Turns confirmed failures into `nightowl.eval/v1` fixtures (and optional vitest/jest `it.todo` stubs) you can review into the project test suite. Offline templates by default; LLM title rewrite only with `--yes`.

```bash
nightowl suggest-regressions [--since <YYYY-MM-DD>] [--category <name>] [--agent <id>] \
  [--status <name>] [--limit <n>] [--framework auto|json|vitest|jest] \
  [--output <dir>] [--force] [--yes] [--transport cli|api] [--model <name>]
```

- Defaults: status `confirmed`; preview on stdout until `--output <dir>` is set.
- `--framework auto` detects vitest/jest from `package.json`, otherwise writes JSON fixtures only.
- Overwriting unknown files requires `--force` (NightOwl eval JSON / `// nightowl-suggested-regression` stubs are safe to replace).

#### `nightowl rule-impact`

Marks a project rule as applied (local baseline snapshot) and compares non-dismissed failure counts in equal-length windows before/after. Offline; no LLM; does **not** change `nightowl report` / `--fail-on-rate`.

```bash
# After you paste a suggested rule into CLAUDE.md / .cursorrules yourself:
nightowl rule-impact mark --label convention-naming --category convention

# Compare default 14-day windows (or override)
nightowl rule-impact
nightowl rule-impact --json --before-days 14 --after-days 14
nightowl rule-impact --label convention-naming
```

- Mark upserts by `--label` (same label updates baseline / `applied_at`).
- Show uses filters stored on the mark. Negative delta means fewer failures after apply (observational only — not causal proof).

---

### 3. Evaluation & Benchmarking Engine

#### `nightowl classify` (opt-in)

Categorizes recorded failures into 4 distinct archetypes: `logic`, `convention`, `misread-requirement`, or `missing-context`.

```bash
nightowl classify [--yes] [--transport cli|api] [--model <name>] [--limit <1-100>] [--redo]
```

- `--yes`: Required to execute LLM calls (prevents unexpected API charges).
- `--transport cli|api`: `cli` (default) spawns local isolated `claude -p`; `api` uses direct Anthropic Messages API (`ANTHROPIC_API_KEY`).
- `--redo`: Re-analyzes failures that were already classified.

#### `nightowl export`

Compiles recorded failures into evaluation datasets.

```bash
nightowl export [--out <file>] [--format jsonl|swe-bench|promptfoo] \
  [--regressions-dir <dir>] [--since <YYYY-MM-DD>] [--category <name>] [--force]
```

- `--format jsonl` (default): `nightowl.eval/v1` JSONL → `.nightowl/export/evals.jsonl`.
- `--format swe-bench`: best-effort SWE-bench-**compatible** JSONL (`instance_id`, `repo`, `base_commit`, `problem_statement`, `patch`, …). Without `--regressions-dir`, harness fields like `FAIL_TO_PASS` / `test_patch` stay empty. With `--regressions-dir` pointing at stubs from `suggest-regressions` (`{id}.test.ts` with the NightOwl marker), matching instances get `FAIL_TO_PASS` (relative stub path) and a `test_patch` that adds that stub. Still **not** the official SWE-bench dataset.
- `--regressions-dir <dir>`: used for `--format swe-bench` only; directory must exist.
- `--format promptfoo`: Promptfoo YAML config → `.nightowl/export/promptfooconfig.yaml` (replace the `echo` provider before running Promptfoo).
- Files use mode `0600`. Export never calls the network.

#### `nightowl eval` (opt-in)

Executes exported test cases against different AI models to measure accuracy and prevent regressions.

```bash
nightowl eval [--yes] [--input <file>] [--model <name>] [--limit <1-100>] \
  [--test-command <cmd>] [--test-timeout <1-600>] [--require-tests]
```

- `--model <name>`: Models to benchmark (repeatable, defaults to `haiku` and `sonnet`).
- `--test-command <cmd>`: **Execution verifier**: writes the generated output to disk, runs your actual test runner (e.g., `npm test`, `pytest`), and restores the file.
- `--require-tests`: Declares a test case passing **only** if the test runner exits with code `0`.

**Scoring Metrics:**
- **coverage**: Fraction of developer-corrected lines reproduced.
- **repeat**: Fraction of defective AI code repeated.
- **score** = `coverage × (1 - repeat)` (score ≥ 0.5 is passing).

### 4. Shell completion

#### `nightowl completion`

Prints a tab-completion script for Bash, Zsh, or Fish (subcommands + common flags). No network; does not write files.

```bash
nightowl completion <bash|zsh|fish>
```

Install examples:

```bash
# Bash
eval "$(nightowl completion bash)"

# Zsh
eval "$(nightowl completion zsh)"

# Fish
nightowl completion fish | source
```

Add the same line to your shell rc (`~/.bashrc`, `~/.zshrc`, or Fish config) to load completion in every session.

---

## CI/CD Quality Gate Integration

Use the composite Action shipped in this repo for a one-step quality gate and optional sticky PR comment:

```yaml
name: AI Quality Gate

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write # required when comment-on-pr is true (default)

jobs:
  nightowl-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # .nightowl/ is gitignored — checkout will not include nightowl.db.
      # Pick one restore path (examples; team must upload/cache the DB themselves):

      # Option A — download an artifact produced by a prior job/workflow that uploaded `.nightowl/nightowl.db`
      - uses: actions/download-artifact@v4
        with:
          name: nightowl-db
          path: .nightowl

      # Option B — restore from actions/cache (populate the cache in another trusted job first)
      # - uses: actions/cache@v4
      #   with:
      #     path: .nightowl/nightowl.db
      #     key: nightowl-db-${{ github.repository }}-${{ github.ref_name }}
      #     restore-keys: |
      #       nightowl-db-${{ github.repository }}-

      - uses: hoanghainh1188/nightowl-evals/action@main
        with:
          fail-on-rate: '20'
          since: '2026-01-01'
          nightowl-version: '0.3.0' # pin a published semver in production
          comment-on-pr: 'true'
          output-path: nightowl-report.json
          # optional: ingest JUnit before report (file-first; no invented ai_content)
          # junit-path: test-results/junit.xml

      - name: Archive NightOwl Report
        if: always() && hashFiles('nightowl-report.json') != ''
        uses: actions/upload-artifact@v4
        with:
          name: ai-quality-report
          path: nightowl-report.json
```

**Inputs:** `fail-on-rate` (default `25`), `since`, `output-path`, `working-directory`, `nightowl-version` (default `latest`), `comment-on-pr` (default `true`), `github-token`, `junit-path` (optional; when set and the file exists, runs `nightowl ingest-ci` before `report`).

**Notes:** The Action does not create or sync `.nightowl/`. Without `nightowl.db` on the runner the step fails with a clear restore hint (download-artifact / cache / self-hosted). If the DB exists but has **0 failures**, the Action emits a warning and still runs `report` (gate pass when nothing was checked). Sticky comments use the GitHub API with your workflow token only — the `nightowl` binary itself still makes no network calls by default (`ingest-pr --github` is opt-in CLI only; the Action does not call GitHub for PR comment ingest). Comments run only for same-repo PRs (fork PRs skip commenting because `GITHUB_TOKEN` cannot write). If you set `working-directory`, point `upload-artifact` / `hashFiles` / restore steps at `{working-directory}/.nightowl/nightowl.db` and `{working-directory}/{output-path}`.

---

## Security & Privacy Guarantees

NightOwl is built from the ground up for strict enterprise security:

| Guarantee | How NightOwl Enforces It |
| :--- | :--- |
| **Zero Telemetry** | 100% offline-first. No tracking code, no third-party HTTP calls, no analytics. |
| **Local SQLite** | Stored entirely inside `.nightowl/nightowl.db` using Node.js native `node:sqlite`. |
| **Strict File Permissions** | Directory initialized with mode `0700` (POSIX); exports and runs stored with `0600`. |
| **Secret Blacklist** | Files matching `.env*`, `*credential*`, `*token*`, `*.pem`, `*.key` are never snapshotted. |
| **Inline Secret Scanner** | Scans code diffs for AWS keys, GitHub tokens, Anthropic/OpenAI keys, and private keys before recording. |
| **Fail-Open Hooks** | 2-second timeout; always returns exit code `0`; will never disrupt normal developer workflows. |

---

## Development & Contributing

NightOwl is developed following strict [OpenSpec](https://github.com/Fission-AI/OpenSpec) specification-driven methodology and Test-Driven Development (TDD).

```bash
npm run typecheck       # Strict TypeScript typechecking
npm test                # Run 740+ unit and integration tests
npm run test:coverage   # Verify test coverage (>95% enforced)
npm run spec:validate   # Validate OpenSpec specifications strictly
npm run build           # Bundle CLI binary using tsup
```

Specifications are maintained under [`openspec/specs/`](openspec/specs/).

---

## License

[Apache-2.0](LICENSE) — Copyright 2026 Hoang Hai
