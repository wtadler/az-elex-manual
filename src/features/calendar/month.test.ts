import { describe, expect, it } from 'vitest'
import { row } from './fixtures'
import { defaultMonth, entriesByDate, isMonthKey, monthGrid, monthOf, shiftMonth } from './month'

describe('isMonthKey', () => {
  it.each(['2026-01', '2026-12', '1999-09'])('accepts %s', (s) => expect(isMonthKey(s)).toBe(true))
  it.each(['2026-00', '2026-13', '2026-1', '26-01', '2026-01-01', '', 'abc'])('rejects %j', (s) =>
    expect(isMonthKey(s)).toBe(false),
  )
})

describe('shiftMonth', () => {
  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-03', -14, '2025-01'],
    ['2026-03', 0, '2026-03'],
    ['2025-11', 25, '2027-12'],
  ])('%s %+d -> %s', (m, n, out) => expect(shiftMonth(m, n)).toBe(out))
})

describe('monthGrid', () => {
  it('starts on Sunday and pads from the previous month', () => {
    // October 1, 2026 is a Thursday.
    const weeks = monthGrid('2026-10')
    expect(weeks[0][0]).toEqual({ date: '2026-09-27', inMonth: false })
    expect(weeks[0][4]).toEqual({ date: '2026-10-01', inMonth: true })
  })

  it('covers every day of the month exactly once, in order', () => {
    for (const m of ['2026-02', '2026-10', '2024-02', '2025-12', '2027-01']) {
      const days = monthGrid(m).flat().filter((d) => d.inMonth).map((d) => d.date)
      const [y, mo] = m.split('-').map(Number)
      const length = new Date(Date.UTC(y, mo, 0)).getUTCDate()
      expect(days).toHaveLength(length)
      expect(days[0]).toBe(`${m}-01`)
      expect(days.at(-1)).toBe(`${m}-${length}`)
      expect([...days].sort()).toEqual(days)
    }
  })

  it('has full weeks of seven consecutive days', () => {
    const all = monthGrid('2026-08').flat()
    expect(all.length % 7).toBe(0)
    for (let i = 1; i < all.length; i++) {
      const gap = (Date.parse(all[i].date) - Date.parse(all[i - 1].date)) / 86_400_000
      expect(gap).toBe(1)
    }
  })

  it('needs no padding when the month starts on Sunday', () => {
    // February 1, 2026 is a Sunday and February 2026 has exactly four weeks.
    const weeks = monthGrid('2026-02')
    expect(weeks).toHaveLength(4)
    expect(weeks[0][0]).toEqual({ date: '2026-02-01', inMonth: true })
  })

  it('uses six weeks when the month spans them', () => {
    // August 1, 2026 is a Saturday, so 31 days span six weeks.
    expect(monthGrid('2026-08')).toHaveLength(6)
  })

  it('pads the last week into the next month, across a year end', () => {
    const last = monthGrid('2026-12').at(-1)!
    expect(last.at(-1)).toEqual({ date: '2027-01-02', inMonth: false })
  })
})

describe('entriesByDate', () => {
  it('groups rows by date and keeps their order', () => {
    const a = row({ date: '2026-10-20', event: 'A' })
    const b = row({ date: '2026-10-21', event: 'B' })
    const c = row({ date: '2026-10-20', event: 'C' })
    const map = entriesByDate([a, b, c])
    expect(map.get('2026-10-20')).toEqual([a, c])
    expect(map.get('2026-10-21')).toEqual([b])
    expect(map.get('2026-10-22')).toBeUndefined()
  })

  it('is empty for no rows', () => {
    expect(entriesByDate([]).size).toBe(0)
  })
})

describe('defaultMonth', () => {
  const rows = [row({ date: '2025-03-01' }), row({ date: '2026-11-03' }), row({ date: '2026-06-15' })]

  it('uses the current month when it falls within the rows', () => {
    expect(defaultMonth(rows, '2026-10-09')).toBe('2026-10')
  })

  it('includes the first and last months', () => {
    expect(defaultMonth(rows, '2025-03-20')).toBe('2025-03')
    expect(defaultMonth(rows, '2026-11-30')).toBe('2026-11')
  })

  it('jumps ahead to the next row when today is before every row', () => {
    expect(defaultMonth(rows, '2024-12-31')).toBe('2025-03')
  })

  it('falls back to the last row when today is after every row', () => {
    expect(defaultMonth(rows, '2027-05-01')).toBe('2026-11')
  })

  it('uses the current month when there are no rows', () => {
    expect(defaultMonth([], '2026-10-09')).toBe('2026-10')
  })
})

describe('monthOf', () => {
  it('takes the year and month of a date', () => expect(monthOf('2026-10-09')).toBe('2026-10'))
})
