import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { errorMessage } from '../cli/errors.js';
import { renderCommandHelp } from '../cli/help.js';
import {
  DEFAULT_COMPARE_HTML_RELATIVE,
  buildCompareReport,
  formatCompareHtml,
  formatCompareMarkdown,
  parseRunFile,
  type ParsedRunFile,
} from '../eval/compare.js';
import { writeFileAtomic } from '../setup/fs-utils.js';
import { printable } from '../shared/printable.js';
import type { Command } from './command.js';
import { ruleAppliedNote } from './rule-applied-note.js';

export interface EvalCompareDeps {
  readonly cwd: () => string;
  readonly readFile?: (path: string) => Promise<string>;
  readonly writeFile?: (path: string, content: string) => Promise<void>;
}

interface Options {
  readonly input: string;
  readonly baseline: string | null;
  readonly format: 'md' | 'html';
  readonly output: string | null;
}

async function loadParsed(path: string, read: (path: string) => Promise<string>): Promise<ParsedRunFile | string> {
  try {
    return parseRunFile(await read(path));
  } catch (error) {
    return `cannot read ${printable(path)}: ${errorMessage(error)}`;
  }
}

function parseOptions(args: readonly string[]): Options | string {
  let values;
  try {
    values = parseArgs({
      args: [...args],
      options: {
        input: { type: 'string' },
        baseline: { type: 'string' },
        format: { type: 'string' },
        output: { type: 'string', short: 'o' },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return errorMessage(error);
  }
  if (values.input === undefined || values.input === '') return '--input needs a results JSONL path';
  if (values.baseline === '') return '--baseline needs a results JSONL path';
  const formatRaw = values.format ?? 'md';
  if (formatRaw !== 'md' && formatRaw !== 'html') return '--format must be md or html';
  if (values.output === '') return '--output needs a file path';
  return {
    input: values.input,
    baseline: values.baseline ?? null,
    format: formatRaw,
    output: values.output ?? null,
  };
}

export function createEvalCompareCommand(
  deps: EvalCompareDeps = { cwd: () => process.cwd() },
): Command {
  const read = deps.readFile ?? ((path: string) => readFile(path, 'utf8'));
  const write =
    deps.writeFile ?? ((path: string, content: string) => writeFileAtomic(path, content, 0o600));

  return {
    name: 'eval-compare',
    summary: 'Compare local eval run JSONL files as an A/B report (no model calls)',
    help: renderCommandHelp({
      name: 'eval-compare',
      usage: '--input <file> [options]',
      description: [
        'Reads NightOwl eval result JSONL under .nightowl/runs/ (or any path) and prints a local A/B table.',
        'Optional --baseline adds per-model deltas. Does not call the network or Claude.',
        'Markdown goes to stdout by default; HTML writes a self-contained file.',
      ],
      options: [
        ['--input <file>', 'Current run JSONL (required)'],
        ['--baseline <file>', 'Baseline run JSONL for deltas'],
        ['--format md|html', 'Output format (default: md)'],
        ['-o, --output <file>', `Write output to a file (html default: ${DEFAULT_COMPARE_HTML_RELATIVE})`],
      ],
    }),
    run: async (args, io) => {
      const options = parseOptions(args);
      if (typeof options === 'string') {
        io.stderr(`nightowl eval-compare: ${options}\n`);
        return 1;
      }
      const cwd = deps.cwd();
      const current = await loadParsed(resolve(cwd, options.input), read);
      if (typeof current === 'string') {
        io.stderr(`nightowl eval-compare: ${current}\n`);
        return 1;
      }
      let baseline: ParsedRunFile | null = null;
      if (options.baseline !== null) {
        const loaded = await loadParsed(resolve(cwd, options.baseline), read);
        if (typeof loaded === 'string') {
          io.stderr(`nightowl eval-compare: ${loaded}\n`);
          return 1;
        }
        baseline = loaded;
      }

      const report = buildCompareReport({
        current,
        baseline,
        ruleNote: await ruleAppliedNote(cwd),
      });
      const content = options.format === 'html' ? formatCompareHtml(report) : formatCompareMarkdown(report);

      if (options.format === 'md' && options.output === null) {
        io.stdout(content);
        return 0;
      }
      const outPath =
        options.output === null
          ? resolve(cwd, DEFAULT_COMPARE_HTML_RELATIVE)
          : resolve(cwd, options.output);
      try {
        await mkdir(dirname(outPath), { recursive: true });
        await write(outPath, content);
      } catch (error) {
        io.stderr(`nightowl eval-compare: cannot write ${printable(outPath)}: ${printable(errorMessage(error))}\n`);
        return 1;
      }
      io.stderr(`Wrote compare report to ${printable(outPath)}\n`);
      return 0;
    },
  };
}

export const evalCompareCommand = createEvalCompareCommand();
