// Pure helpers for Gemini's quota reset, which happens at midnight US Pacific.

/** Returns YYYY-MM-DD for the given instant in America/Los_Angeles. */
export function pacificDateString(now: Date): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return fmt.format(now) // en-CA yields YYYY-MM-DD
}

/** Milliseconds remaining until the next Pacific midnight. */
export function msUntilPacificMidnight(now: Date): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const h = get('hour') % 24
  const m = get('minute')
  const s = get('second')
  const elapsed = (h * 3600 + m * 60 + s) * 1000
  return 86_400_000 - elapsed
}
