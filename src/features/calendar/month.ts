import type { CalendarEntry } from '../../shared/types'
import { addDays } from './labels'

// Month grid logic. A month key is "YYYY-MM"; dates are ISO "YYYY-MM-DD" with no time zone.

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/

export function isMonthKey(s: string): boolean {
  return MONTH_KEY.test(s)
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

/** The month `n` months after `month` (negative goes back). */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export interface GridDay {
  date: string
  inMonth: boolean
}

/** Weeks (Sunday first) covering the month, padded with days from the adjacent months. */
export function monthGrid(month: string): GridDay[][] {
  const first = `${month}-01`
  const weekday = new Date(`${first}T00:00:00Z`).getUTCDay()
  let day = addDays(first, -weekday)
  const weeks: GridDay[][] = []
  do {
    const week: GridDay[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ date: day, inMonth: monthOf(day) === month })
      day = addDays(day, 1)
    }
    weeks.push(week)
  } while (monthOf(day) === month)
  return weeks
}

/** Rows indexed by date, keeping their order. */
export function entriesByDate(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>()
  for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e])
  return map
}

/**
 * Month to open on: the current month if it falls within the rows' date range, otherwise the
 * month of the next row after today, otherwise the month of the last row. With no rows, the
 * current month.
 */
export function defaultMonth(entries: CalendarEntry[], today: string): string {
  if (entries.length === 0) return monthOf(today)
  const dates = entries.map((e) => e.date).sort()
  const current = monthOf(today)
  if (current >= monthOf(dates[0]) && current <= monthOf(dates[dates.length - 1])) return current
  const next = dates.find((d) => d >= today)
  return monthOf(next ?? dates[dates.length - 1])
}
