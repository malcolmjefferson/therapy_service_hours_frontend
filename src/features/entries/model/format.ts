const DATE = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** `2026-01-05` as `Jan 5, 2026`. A session date has no time zone, so it is formatted as UTC to never shift a day. */
export function formatSessionDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? isoDate : DATE.format(date);
}

/** `09:00 to 10:15`, or `null` for a legacy entry that has no times. */
export function formatTimeRange(start: string | undefined, end: string | undefined): string | null {
  return start !== undefined && end !== undefined ? `${start} to ${end}` : null;
}
