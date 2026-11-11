function extOf(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot).toLowerCase();
}

function stripHashComments(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const i = line.indexOf('#');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

function stripCStyleComments(text: string): string {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
  return out;
}

/** Removes comments using a simple language guess from the file path. */
export function stripComments(text: string, filePath: string): string {
  const ext = extOf(filePath);
  if (ext === '.py' || ext === '.sh' || ext === '.yaml' || ext === '.yml' || ext === '.toml') {
    return stripHashComments(text);
  }
  return stripCStyleComments(text);
}

export function stripWhitespace(text: string): string {
  return text.replace(/\s+/g, '');
}

export function stripFormatNoise(text: string): string {
  return stripWhitespace(text).replace(/[.,;:`'"()[\]{}]/g, '');
}
