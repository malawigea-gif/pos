export function defaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return { from: firstOfMonth.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) }
}

/** sale_date is a full timestamp, so a plain YYYY-MM-DD "to" date would
 *  exclude same-day sales made after midnight — widen to the full day. */
export function toQueryDateRange(from: string, to: string): { from: string; to: string } {
  return { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` }
}
