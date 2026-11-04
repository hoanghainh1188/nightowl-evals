// Strips control characters (terminal escape sequences) from text taken from the repository.
export function printable(text: string): string {
  // biome-ignore lint: control characters are the point here.
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?');
}
