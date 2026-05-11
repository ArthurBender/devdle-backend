export function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}
