# NightOwl Evals

Record every time AI writes wrong code, and turn those failures into an eval suite for your own project.

When Claude Code writes code and you fix it by hand before committing, that fix usually disappears. Next time the AI makes the same mistake. NightOwl notices the fix at commit time, keeps the AI version and your corrected version side by side, and lets you:

- see where the AI goes wrong, by type, module and week (`nightowl report`);
- export each failure as a test case (`nightowl export`);
- re-run those cases against Claude models and compare scores (`nightowl eval`).

**Everything stays on your machine.** Data lives in `.nightowl/` inside your repository (git-ignored). Nothing is sent anywhere unless you run `classify` or `eval` with `--yes`, which call your own local `claude` CLI.

## Requirements

- Node.js 22.13 or newer
- git
- [Claude Code](https://docs.claude.com/claude-code) — the AI whose edits are recorded, and the `claude` CLI used by `classify` and `eval`

## Install

From source (not yet published to npm):

```bash
git clone https://github.com/hoanghainh1188/nightowl-evals.git
cd nightowl-evals
npm install
npm run build
npm link
```

`nightowl` must be on your `PATH`: the hooks call it by name, and quietly do nothing if it is missing.

## Quick start

In the repository you work on with Claude Code:

```bash
nightowl init
```

This adds, without removing anything already there:

| File | What it does |
| --- | --- |
| `.claude/settings.local.json` | Claude Code hooks that run `nightowl log` after each prompt and each file edit. This file is yours only |
| `.git/hooks/pre-commit` | Runs `nightowl precommit`: compares staged files with what the AI last wrote |
| `.git/hooks/post-commit` | Runs `nightowl postcommit`: records a failure when the committed file differs from the AI version |
| `.gitignore` | Adds `.nightowl/`, and `.claude/settings.local.json` if git does not ignore it yet |

The hooks go in your personal settings, so teammates who share the repository are not affected. If your team agrees to record together, use `nightowl init --shared` to put them in `.claude/settings.json` instead. The Claude Code hook checks that `nightowl` is installed first, so machines without it stay quiet.

Then work as usual: prompt Claude Code, fix what it got wrong, commit. Check what has been collected:

```bash
nightowl failures
nightowl report
```

The hooks never block Claude Code or a commit. They always exit 0, print nothing, and give up after 2 seconds.

## How a failure is detected

1. After Claude Code edits a file, NightOwl stores a snapshot of what the AI wrote.
2. At `git commit`, the pre-commit hook compares the latest AI snapshot of each staged file with the staged content.
3. After the commit, the post-commit hook keeps only comparisons that match the committed file. If you changed the AI's lines (not just whitespace), it records a **failure**: the prompt, the AI version, your final version and the commit.

Failures have a **source**:

- `manual-fix`: you edited the AI's code yourself before committing.
- `ai-self-fix`: you told the AI it was wrong and it redid the edit. NightOwl sees an AI edit, then a prompt from you in the same Claude Code session, then another AI edit of the same file. If the AI then dropped or changed lines of the edit you answered (not just whitespace), that edit is the failure, and your prompt is kept as its feedback. When your prompt only made the AI add code (a new request rather than a correction), nothing is recorded.

The content of files that look sensitive (`.env`, keys, credentials) is never stored.

## Commands

### `nightowl report`

Failures grouped by type, source, module and ISO week, plus the share of committed AI edits that had to change.

| Option | Meaning |
| --- | --- |
| `--since <YYYY-MM-DD>` | Only failures from this date on |
| `--depth <1-5>` | How many folder levels make up a module (default 2) |
| `--json` | Machine-readable output |

### `nightowl export`

Writes one JSON line per failure (`nightowl.eval/v1`) to `.nightowl/export/evals.jsonl`, readable only by you. Each case holds the prompt, the file before the AI edit, the AI version (`rejected`), your version (`expected`), the `source`, and for `ai-self-fix` the prompt you used to correct the AI (`input.feedback`). `nightowl eval` never shows that feedback to the model under test.

| Option | Meaning |
| --- | --- |
| `--out <file>` | Write elsewhere; `-` for stdout |
| `--force` | Overwrite a file that is not a NightOwl export |
| `--since <YYYY-MM-DD>` | Only failures from this date on |
| `--category <name>` | Only this category; repeatable. One of `logic`, `convention`, `misread-requirement`, `missing-context`, `unclassified` |

### `nightowl classify` (sends data, opt-in)

Asks Claude to sort failures into four categories: `logic`, `convention`, `misread-requirement`, `missing-context`.

Without `--yes` it only says how many failures it would send. With `--yes` it sends the prompt, the AI version and your version of each failure through `claude -p`. Tools, MCP servers and slash commands are all switched off, and the call runs from an empty temporary folder.

| Option | Meaning |
| --- | --- |
| `--yes` | Actually call Claude |
| `--limit <1-100>` | At most this many failures (default 20) |
| `--model <name>` | Claude model (default `haiku`) |
| `--redo` | Classify again failures already classified |

### `nightowl eval` (sends data, opt-in)

Gives each exported case to Claude models and scores how close their answer is to your fix.

- **coverage**: the share of your added lines that the model also wrote.
- **repeat**: the share of the AI's wrong lines that the model wrote again.
- **score** = coverage × (1 − repeat). A case passes at 0.5 or more.

Without `--yes` it prints how many calls it would make and which files' content would be sent. With `--yes` it runs them, prints a table per model and the cases where the models disagree, and saves every result to `.nightowl/runs/<time>.jsonl`.

| Option | Meaning |
| --- | --- |
| `--yes` | Actually call Claude |
| `--input <file>` | Suite to run (default `.nightowl/export/evals.jsonl`) |
| `--model <name>` | Model to compare; repeatable (default `haiku` and `sonnet`) |
| `--limit <1-100>` | At most this many cases (default 20) |

Cost depends on your Claude plan. As a rough guide, one test run measured about $0.006 per case with `haiku` and $0.10 with `sonnet`.

### Other commands

| Command | Meaning |
| --- | --- |
| `nightowl failures` | Number of failures recorded so far |
| `nightowl uninstall` | Removes the hooks NightOwl added; keeps `.nightowl/` and `.gitignore` |
| `nightowl log`, `precommit`, `postcommit` | Called by the hooks; you do not run them yourself |
| `nightowl --help`, `--version` | General help and version |
| `nightowl <command> --help` | Options of one command; never runs it (same as `nightowl help <command>`) |

## Data

| Path | Content |
| --- | --- |
| `.nightowl/nightowl.db` | SQLite database: events, AI snapshots, failures, classifications |
| `.nightowl/export/` | Exported suites |
| `.nightowl/runs/` | Eval results |

`.nightowl/` is created with mode 0700, and exports and results with mode 0600. To stop recording, run `nightowl uninstall`. To also delete the recorded data, remove `.nightowl/`.

## Development

```bash
npm run typecheck
npm test
npm run test:coverage
npm run spec:validate
```

Changes follow [OpenSpec](https://github.com/Fission-AI/OpenSpec): current behaviour is specified in [`openspec/specs`](openspec/specs). The product plan is in [`docs/nightowl-evals.md`](docs/nightowl-evals.md).

## License

[Apache-2.0](LICENSE)
