// Builds a function that stops repository content from closing one of `tags` and posing
// as NightOwl's own text inside a prompt.
export function closingTagEscaper(tags: readonly string[]): (text: string) => string {
  const closing = new RegExp(`</(${tags.join('|')})>`, 'gi');
  return (text) => text.replace(closing, '<\\/$1>');
}
