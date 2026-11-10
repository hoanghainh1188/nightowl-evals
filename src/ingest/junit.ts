export interface CiFailRecord {
  readonly filePath: string | null;
  readonly testName: string | null;
  readonly classname: string | null;
  readonly suite: string | null;
  readonly message: string | null;
  readonly commitSha: string | null;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  if (match === null) return null;
  return decodeXml(match[2] ?? match[3] ?? '');
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function failureMessage(body: string): string | null {
  const fail = body.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1\s*>/i) ?? body.match(/<(failure|error)\b([^>]*)\/>/i);
  if (fail === null) return null;
  const fromAttr = attr(`<x ${fail[2] ?? ''}>`, 'message');
  const fromBody = stripCdata(fail[3] ?? '');
  const combined = [fromAttr, fromBody].filter((s) => s != null && s.length > 0).join('\n');
  return combined.length > 0 ? combined.slice(0, 2000) : null;
}

function currentSuite(xml: string, index: number): string | null {
  const before = xml.slice(0, index);
  const opens = [...before.matchAll(/<testsuite\b([^>]*)>/gi)];
  const last = opens[opens.length - 1];
  return last === undefined ? null : attr(last[0], 'name');
}

/** Minimal JUnit XML parser: extracts failed/errored testcases only. */
export function parseJunitXml(xml: string, commitSha: string | null = null): readonly CiFailRecord[] {
  const records: CiFailRecord[] = [];
  const openRe = /<testcase\b/gi;
  let openMatch: RegExpExecArray | null;
  while ((openMatch = openRe.exec(xml)) !== null) {
    const afterOpen = openMatch.index + openMatch[0].length;
    const tagEnd = xml.indexOf('>', afterOpen);
    if (tagEnd === -1) break;
    const openAttrs = xml.slice(afterOpen, tagEnd);
    // Self-closing <testcase .../>
    if (openAttrs.trimEnd().endsWith('/')) continue;
    const closeMatch = /<\/testcase\s*>/i.exec(xml.slice(tagEnd + 1));
    if (closeMatch === null) continue;
    const body = xml.slice(tagEnd + 1, tagEnd + 1 + closeMatch.index);
    // Advance search past this case so nested searches stay ordered.
    openRe.lastIndex = tagEnd + 1 + closeMatch.index + closeMatch[0].length;
    if (!/<(failure|error)\b/i.test(body)) continue;
    const openTag = `<testcase ${openAttrs}>`;
    records.push({
      filePath: attr(openTag, 'file') ?? attr(openTag, 'filepath'),
      testName: attr(openTag, 'name'),
      classname: attr(openTag, 'classname'),
      suite: currentSuite(xml, openMatch.index),
      message: failureMessage(body),
      commitSha,
    });
  }
  return Object.freeze(records);
}
