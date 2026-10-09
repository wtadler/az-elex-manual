const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-10-09" -> "October 9, 2026". Anything else comes back unchanged. */
export function formatRetrieved(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined
  if (!m || !month) return iso
  return `${month} ${Number(m[3])}, ${m[1]}`
}
