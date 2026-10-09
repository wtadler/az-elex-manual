import { describe, expect, it } from 'vitest'
import type { CalendarEntry, Office } from '../shared/types'
import raw from './calendar.json'

// Guards the contract between the calendar parser (Person B) and the calendar UI (Person C).
const entries = raw as CalendarEntry[]
const OFFICES: Office[] = ['REC', 'BOS', 'ELEC', 'SOS']
const DAY_MS = 86_400_000

function electionDate(e: CalendarEntry): string | null {
  if (e.daysFromElection == null) return null
  const t = Date.parse(`${e.date}T00:00:00Z`) - e.daysFromElection * DAY_MS
  return new Date(t).toISOString().slice(0, 10)
}

describe('calendar.json', () => {
  it('is non-empty', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it.each(entries.map((e, i) => [i, e] as const))('row %i has valid fields', (_, e) => {
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(e.date))).toBe(false)
    expect(e.event.trim()).not.toBe('')
    for (const o of e.offices) expect(OFFICES).toContain(o)
    expect(Array.isArray(e.statutes)).toBe(true)
    // Chapter 15 calendar runs from printed page 304 through 320.
    expect(e.epmPage).toBeGreaterThanOrEqual(304)
    expect(e.epmPage).toBeLessThanOrEqual(320)
  })

  it('is sorted by date', () => {
    const dates = entries.map((e) => e.date)
    expect(dates).toEqual([...dates].sort())
  })

  // Every row for one election code should count back to the same Election Day.
  // A mismatch usually means a parsing error in the date or day-count column.
  it('agrees on one election date per election code', () => {
    const byCode = new Map<string, Set<string>>()
    for (const e of entries) {
      const d = electionDate(e)
      if (!e.election || !d) continue
      if (!byCode.has(e.election)) byCode.set(e.election, new Set())
      byCode.get(e.election)!.add(d)
    }
    for (const [code, dates] of byCode) {
      expect({ code, dates: [...dates] }).toEqual({ code, dates: [...dates].slice(0, 1) })
    }
  })
})
