import { describe, expect, it } from 'vitest'
import type { CalendarEntry, Office } from '../shared/types'
import raw from './calendar.json'

// Guards the contract between the calendar parser (Person B) and the calendar UI (Person C).
const entries = raw as CalendarEntry[]
const OFFICES: Office[] = ['REC', 'BOS', 'ELEC', 'SOS', 'GOV']
const DAY_MS = 86_400_000

function electionDate(e: CalendarEntry): string | null {
  if (e.daysFromElection == null) return null
  const t = Date.parse(`${e.date}T00:00:00Z`) - e.daysFromElection * DAY_MS
  return new Date(t).toISOString().slice(0, 10)
}

describe('calendar.json', () => {
  it('has every row of the printed calendar', () => {
    // 304 date-led rows on printed pages 304-320, cross-checked against pdftotext -layout.
    expect(entries).toHaveLength(304)
  })

  it.each(entries.map((e, i) => [i, e] as const))('row %i has valid fields', (_, e) => {
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(e.date))).toBe(false)
    expect(e.event.trim()).not.toBe('')
    expect(e.event).not.toMatch(/\s{2,}|^\s|\s$/)
    for (const o of e.offices) expect(OFFICES).toContain(o)
    expect(new Set(e.offices).size).toBe(e.offices.length)
    expect(Array.isArray(e.statutes)).toBe(true)
    for (const s of e.statutes) expect(s).toMatch(/^(\d{1,2}-\d+(\.\d+)?\S*|Const\. .+|Procedures Manual|MOVE Act)$/)
    if (e.election != null) expect(e.election).toMatch(/^(MAR|MAY|AUG|NOV)_(ODD|EV|NEXT)$/)
    if (e.daysFromElection != null) expect(Number.isInteger(e.daysFromElection)).toBe(true)
    // Chapter 15 calendar runs from printed page 304 through 320.
    expect(e.epmPage).toBeGreaterThanOrEqual(304)
    expect(e.epmPage).toBeLessThanOrEqual(320)
  })

  it('is sorted by date', () => {
    const dates = entries.map((e) => e.date)
    expect(dates).toEqual([...dates].sort())
  })

  // Every row for one election code should count back to the same Election Day. A mismatch
  // usually means a parsing error, except for these rows, where the manual's own day count
  // doesn't match its date. They're printed this way in the EPM; we keep them verbatim.
  const SOURCE_DISCREPANCIES = [
    // "5 business days" after August 4, 2026 is August 11 (+7), but the row says +10.
    '2026-08-11 AUG_EV 10',
    // October 20, 2026 is 14 days before November 3 (another row that day says -14).
    '2026-10-20 NOV_EV -21',
    '2026-10-21 NOV_EV -20',
    '2026-10-22 NOV_EV -19',
  ]
  const key = (e: CalendarEntry) => `${e.date} ${e.election} ${e.daysFromElection}`

  it('agrees on one election date per election code, apart from known source discrepancies', () => {
    const byCode = new Map<string, Map<string, string[]>>()
    for (const e of entries) {
      const d = electionDate(e)
      if (!e.election || !d) continue
      if (!byCode.has(e.election)) byCode.set(e.election, new Map())
      const dates = byCode.get(e.election)!
      dates.set(d, [...(dates.get(d) ?? []), key(e)])
    }
    const outliers: string[] = []
    for (const dates of byCode.values()) {
      const majority = Math.max(...[...dates.values()].map((rows) => rows.length))
      for (const rows of dates.values()) if (rows.length < majority) outliers.push(...rows)
    }
    expect(outliers.sort()).toEqual([...SOURCE_DISCREPANCIES].sort())
  })

  it('derives the expected Election Days', () => {
    const day = (code: string) => {
      const counts = new Map<string, number>()
      for (const e of entries) {
        const d = e.election === code ? electionDate(e) : null
        if (d) counts.set(d, (counts.get(d) ?? 0) + 1)
      }
      return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
    }
    expect(day('MAR_ODD')).toBe('2025-03-11')
    expect(day('NOV_ODD')).toBe('2025-11-04')
    expect(day('AUG_EV')).toBe('2026-08-04')
    expect(day('NOV_EV')).toBe('2026-11-03')
  })

  describe('parser regressions', () => {
    const find = (date: string, text: string) => {
      const row = entries.find((e) => e.date === date && e.event.includes(text))
      expect(row, `${date} ${text}`).toBeDefined()
      return row!
    }

    it('keeps the weekend note', () => {
      expect(find('2025-01-25', 'early ballot not be sent').weekendNote).toBe(
        'Saturday. Moves to next business day.',
      )
    })

    it('splits a reference cell that wraps two statutes across lines', () => {
      expect(find('2025-12-01', 'continued representation').statutes).toEqual([
        '16-804(A)-(D)',
        '16-168(G)(2)(d)',
      ])
    })

    it('joins wrapped constitution citations', () => {
      const all = entries.flatMap((e) => e.statutes)
      expect(all).toContain('Const. Art. VI, § 38(A)(B)')
      expect(all.filter((s) => /^(§|Pt\.|\d+\()/.test(s))).toEqual([])
    })

    it('keeps the "Procedures Manual" reference whole', () => {
      expect(find('2025-02-05', 'Logic and Accuracy').statutes).toEqual(['16-449', 'Procedures Manual'])
    })

    it('reads a merged cell that spans the code and day columns as event text', () => {
      const row = find('2025-09-26', 'General effective date')
      expect(row.election).toBeNull()
      expect(row.daysFromElection).toBeNull()
      expect(row.event).toMatch(/Fifty-Seventh Legislature, First Regular/)
    })

    it('expands the ALL office code to every office', () => {
      expect(find('2025-09-26', 'Deadline to file Referendum').offices).toEqual(['REC', 'BOS', 'ELEC', 'SOS'])
    })

    it('keeps the GOV office code', () => {
      expect(entries.filter((e) => e.offices.includes('GOV'))).toHaveLength(1)
    })

    it('keeps the source text verbatim, typos included', () => {
      expect(find('2026-08-02', 'Deliver ballots to Inspector').weekendNote).toBe(
        'Sunday. Moves Inspector next business day.',
      )
    })

    it('does not leak footnote text into rows', () => {
      expect(entries.some((e) => /Session Law changed signature cure/.test(e.event))).toBe(false)
    })
  })
})
