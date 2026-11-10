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
    - [`nightowl review`](#nightowl-review)
    - [`nightowl prune`](#nightowl-prune)
    - [`nightowl failures`](#nightowl-failures)
    - [`nightowl suggest-rules`](#nightowl-suggest-rules)
    - [`nightowl suggest-regressions`](#nightowl-suggest-regressions)
  - [Evaluation & Benchmarking Engine](#3-evaluation--benchmarking-engine)
    - [`nightowl classify`](#nightowl-classify-opt-in)
    - [`nightowl export`](#nightowl-export)
    - [`nightowl eval`](#nightowl-eval-opt-in)
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

| Agent | Id | Capture path |
|-------|----|--------------|
| Claude Code | `claude-code` | `.claude/settings(.local).json` hooks |
| Cursor | `cursor` | `.cursor/hooks.json` (`beforeSubmitPrompt`, `afterFileEdit`) |
| Windsurf | `windsurf` | `.windsurf/hooks.json` (NightOwl entry) |
| Cline | `cline` | `.cline/nightowl.json` |
| Roo Code | `roo` | `.roo/nightowl.json` |
| Copilot Workspace | `copilot-workspace` | `.github/copilot-nightowl.json` |
| Aider | `aider` | `.aider/nightowl.json` |

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

#### `nightowl uninstall`

Cleanly removes Git hooks and NightOwl agent hook configurations (Claude Code, Cursor, and the other supported agents). Leaves `.nightowl/` database and historical records intact.

```bash
nightowl uninstall [--purge]
```

- `--purge`: Additionally deletes the `.nightowl/` directory and all local history.

---

### 2. Analytics, Review & Data Ops

#### `nightowl report`

Summarizes AI failures by category, source, agent, module path, and week. JSON includes `by_agent` and `head_to_head` (edit-change rate per agent).

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

#### `nightowl review`

Interactive triage tool to review recorded failures and distinguish genuine AI bugs from intentional developer changes.

```bash
# List unreviewed failures (flagged)
nightowl review [--status flagged|confirmed|dismissed|all] [--source manual-fix|ai-self-fix] [--agent <id>] [--limit N] [--json]

# Inspect full details and unified diff of a failure
nightowl review show <id> [--json]

# Mark status
nightowl review confirm <id...>
nightowl review dismiss <id...>
nightowl review reset <id...>
```

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

Turns repeated classified failures into Markdown rule drafts you can paste into `CLAUDE.md` or `.cursorrules` after review. Heuristic by default (offline); LLM rewrite only with `--yes`.

```bash
nightowl suggest-rules [--since <YYYY-MM-DD>] [--category <name>] [--agent <id>] \
  [--status <name>] [--min-count <n>] [--limit <n>] \
  [--output <file>] [--force] [--yes] [--transport cli|api] [--model <name>]
```

- Defaults: status `confirmed`, categories `convention` + `missing-context`, clusters with at least 2 failures.
- Prints to stdout unless `--output` / `--write` is set. Never auto-edits `CLAUDE.md` or `.cursorrules`.
- Overwriting an existing non-NightOwl file requires `--force` (files containing `<!-- nightowl-suggested-rules -->` are safe to replace).

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

Compiles confirmed failures into standardized evaluation datasets (`nightowl.eval/v1` format).

```bash
nightowl export [--out <file>] [--since <YYYY-MM-DD>] [--category <name>] [--force]
```

- Target file defaults to `.nightowl/export/evals.jsonl` (mode `0600`, readable only by current user).
- Each line contains `{ id, filePath, prompt, rejected, expected, source, feedback }`.

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

---

## CI/CD Quality Gate Integration

Enforce AI code quality standards in your GitHub Actions workflow:

```yaml
name: AI Quality Gate

on:
  pull_request:
    branches: [main]

jobs:
  nightowl-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install NightOwl
        run: npm install -g @hoanghainh/nightowl-evals

      - name: Check AI Failure Rate
        run: |
          # Fail the build if more than 20% of AI edits required developer intervention
          nightowl report --since 2026-01-01 --fail-on-rate 20 --output report.json

      - name: Archive NightOwl Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ai-quality-report
          path: report.json
```

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
