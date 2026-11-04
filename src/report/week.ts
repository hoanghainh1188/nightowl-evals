const DAY_MS = 86_400_000;

// ISO 8601 week of a YYYY-MM-DD day in UTC, e.g. "2026-W45".
export function isoWeek(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  // The Thursday of the same week decides which year the week belongs to.
  const thursday = new Date(date.getTime() + (3 - ((date.getUTCDay() + 6) % 7)) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = 1 + Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
