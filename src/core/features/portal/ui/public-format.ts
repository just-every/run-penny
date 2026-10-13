export function formatPublicDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}
