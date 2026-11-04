// Turns a YYYY-MM-DD option into the start of that day in UTC, as stored in created_at.
export function parseDateOption(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? date.toISOString() : null;
}
