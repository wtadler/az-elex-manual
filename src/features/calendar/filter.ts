import type { CalendarEntry, Office } from '../../shared/types'
import { addDays, formatMonth } from './labels'

/** Election filter value that selects rows with no election code. */
export const CYCLE_WIDE = 'cycle'
/** Election filter value that selects every row. */
export const ALL_ELECTIONS = ''

export interface Filters {
  /** ALL_ELECTIONS, CYCLE_WIDE, or an election code. */
  election: string
  /** Rows matching any of these offices. Empty means no office filter. */
  offices: Office[]
  /** Free text. Every word must appear in the event or a statute (case-insensitive). */
  query: string
}

export const NO_FILTERS: Filters = { election: ALL_ELECTIONS, offices: [], query: '' }

function matchesElection(e: CalendarEntry, election: string): boolean {
  if (election === ALL_ELECTIONS) return true
  if (election === CYCLE_WIDE) return e.election == null
  return e.election === election
}

function matchesOffices(e: CalendarEntry, offices: Office[]): boolean {
  return offices.length === 0 || e.offices.some((o) => offices.includes(o))
}

function matchesQuery(e: CalendarEntry, words: string[]): boolean {
  if (words.length === 0) return true
  const haystack = [e.event, ...e.statutes].join('\n').toLowerCase()
  return words.every((w) => haystack.includes(w))
}

export function filterEntries(entries: CalendarEntry[], f: Filters): CalendarEntry[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean)
  return entries.filter(
    (e) => matchesElection(e, f.election) && matchesOffices(e, f.offices) && matchesQuery(e, words),
  )
}

/** Rows dated from `today` through `today + days`, inclusive on both ends. */
export function upcoming(entries: CalendarEntry[], today: string, days: number): CalendarEntry[] {
  const end = addDays(today, days)
  return entries.filter((e) => e.date >= today && e.date <= end)
}

export type View = 'upcoming' | 'all' | 'month'

/** The upcoming view if it has rows, otherwise everything. */
export function defaultView(entries: CalendarEntry[], today: string, days: number): View {
  return upcoming(entries, today, days).length > 0 ? 'upcoming' : 'all'
}

export interface MonthGroup {
  /** "2025-03" */
  key: string
  /** "March 2025" */
  label: string
  entries: CalendarEntry[]
}

/** Sorts rows by date (stable) and groups them under month headings. */
export function groupByMonth(entries: CalendarEntry[]): MonthGroup[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const groups: MonthGroup[] = []
  for (const e of sorted) {
    const key = e.date.slice(0, 7)
    const last = groups.at(-1)
    if (last?.key === key) last.entries.push(e)
    else groups.push({ key, label: formatMonth(e.date), entries: [e] })
  }
  return groups
}
