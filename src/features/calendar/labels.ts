import type { CalendarEntry, Office } from '../../shared/types'

// Display labels and date math for the calendar. All dates are ISO "YYYY-MM-DD"
// calendar dates with no time zone; math is done in UTC so DST never shifts a day.

export const OFFICE_NAMES: Record<Office, string> = {
  REC: 'County Recorder',
  BOS: 'Board of Supervisors',
  ELEC: 'Officer in charge of elections',
  SOS: 'Secretary of State',
}

export const OFFICES: Office[] = ['REC', 'BOS', 'ELEC', 'SOS']

/** Label for rows with no election code. */
export const CYCLE_WIDE_LABEL = 'All elections/cycle-wide'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_MS = 86_400_000

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

function toUtc(iso: string): number {
  const [y, m, d] = parts(iso)
  return Date.UTC(y, m - 1, d)
}

function fromUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** ISO date `n` days after `iso` (negative for before). */
export function addDays(iso: string, n: number): string {
  return fromUtc(toUtc(iso) + n * DAY_MS)
}

/** Today's date in the viewer's local time zone, as ISO. */
export function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "Tuesday, March 11, 2025" */
export function formatLongDate(iso: string): string {
  const [y, m, d] = parts(iso)
  const weekday = WEEKDAYS[new Date(toUtc(iso)).getUTCDay()]
  return `${weekday}, ${MONTHS[m - 1]} ${d}, ${y}`
}

/** "March 11, 2025" */
export function formatDate(iso: string): string {
  const [y, m, d] = parts(iso)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** "March 2025" for a month key "2025-03" or a full ISO date. */
export function formatMonth(iso: string): string {
  const [y, m] = parts(iso)
  return `${MONTHS[m - 1]} ${y}`
}

/** Election Day implied by one row: its date minus its day offset. */
export function derivedElectionDay(e: CalendarEntry): string | null {
  if (e.daysFromElection == null) return null
  return addDays(e.date, -e.daysFromElection)
}

/**
 * Election Day for each election code, derived from the rows. If rows disagree,
 * the most common derived date wins; ties go to the earliest date.
 */
export function electionDays(entries: CalendarEntry[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>()
  for (const e of entries) {
    const day = derivedElectionDay(e)
    if (!e.election || !day) continue
    const byDay = counts.get(e.election) ?? new Map<string, number>()
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
    counts.set(e.election, byDay)
  }
  const result = new Map<string, string>()
  for (const [code, byDay] of counts) {
    const [best] = [...byDay].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    result.set(code, best[0])
  }
  return result
}

export interface ElectionOption {
  code: string
  /** ISO Election Day, or null when no row for the code has a day offset. */
  date: string | null
  /** "November 3, 2026", or the code itself when the date can't be derived. */
  label: string
}

/** Every election code in the data, labeled by Election Day and sorted by date. */
export function electionOptions(entries: CalendarEntry[]): ElectionOption[] {
  const days = electionDays(entries)
  const codes = new Set<string>()
  for (const e of entries) if (e.election) codes.add(e.election)
  return [...codes]
    .map((code) => {
      const date = days.get(code) ?? null
      return { code, date, label: date ? formatDate(date) : code }
    })
    .sort((a, b) => {
      if (a.date && b.date) return a.date.localeCompare(b.date) || a.code.localeCompare(b.code)
      if (a.date) return -1
      if (b.date) return 1
      return a.code.localeCompare(b.code)
    })
}

/** Election label for a row, given a code-to-label map. */
export function electionLabel(code: string | null, labels: Map<string, string>): string {
  if (code == null) return CYCLE_WIDE_LABEL
  return labels.get(code) ?? code
}

/** Short day-offset badge: "E−45", "E+3", "Election Day". */
export function offsetLabel(days: number): string {
  if (days === 0) return 'Election Day'
  return days < 0 ? `E−${-days}` : `E+${days}`
}

/** Spoken form of the day offset, for screen readers. */
export function offsetDescription(days: number): string {
  if (days === 0) return 'Election Day'
  const n = Math.abs(days)
  return `${n} ${n === 1 ? 'day' : 'days'} ${days < 0 ? 'before' : 'after'} the election`
}
