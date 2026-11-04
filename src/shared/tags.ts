// Builds a function that stops repository content from opening or closing one of `tags` and
// posing as NightOwl's own text inside a prompt. Spaced and upper-case forms count too.
export function closingTagEscaper(tags: readonly string[]): (text: string) => string {
  const tag = new RegExp(`<(\\s*\\/?\\s*)(${tags.join('|')})(\\s*)>`, 'gi');
  return (text) => text.replace(tag, '<\\$1$2$3>');
}
