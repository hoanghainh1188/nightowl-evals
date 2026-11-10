export const ESC = '\u001b';
export const CLEAR_SCREEN = `${ESC}[2J${ESC}[H`;
export const HIDE_CURSOR = `${ESC}[?25l`;
export const SHOW_CURSOR = `${ESC}[?25h`;
export const RESET = `${ESC}[0m`;
export const BOLD = `${ESC}[1m`;
export const DIM = `${ESC}[2m`;
export const INVERSE = `${ESC}[7m`;
export const GREEN = `${ESC}[32m`;
export const RED = `${ESC}[31m`;
export const CYAN = `${ESC}[36m`;

export function colorDiffLine(line: string): string {
  if (line.startsWith('+') && !line.startsWith('+++')) return `${GREEN}${line}${RESET}`;
  if (line.startsWith('-') && !line.startsWith('---')) return `${RED}${line}${RESET}`;
  if (line.startsWith('@')) return `${CYAN}${line}${RESET}`;
  return line;
}
