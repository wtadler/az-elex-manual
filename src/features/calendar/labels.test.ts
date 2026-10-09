import { describe, expect, it } from 'vitest'
import { row } from './fixtures'
import {
  addDays,
  CYCLE_WIDE_LABEL,
  derivedElectionDay,
  electionDays,
  electionLabel,
  electionOptions,
  formatDate,
  formatLongDate,
  formatMonth,
  localIsoDate,
  OFFICE_NAMES,
  offsetDescription,
  offsetLabel,
} from './labels'

describe('date formatting', () => {
  it.each([
    ['2025-03-11', 'Tuesday, March 11, 2025'],
    ['2026-11-03', 'Tuesday, November 3, 2026'],
    ['2025-01-25', 'Saturday, January 25, 2025'],
    ['2024-02-29', 'Thursday, February 29, 2024'],
    ['2027-12-31', 'Friday, December 31, 2027'],
  ])('formatLongDate(%s) = %s', (iso, label) => {
    expect(formatLongDate(iso)).toBe(label)
  })

  it('formats without ordinals and with full month names', () => {
    expect(formatDate('2026-09-01')).toBe('September 1, 2026')
    expect(formatMonth('2026-09-01')).toBe('September 2026')
    expect(formatMonth('2026-09')).toBe('September 2026')
  })
})

describe('addDays', () => {
  it.each([
    ['2025-01-31', 1, '2025-02-01'],
    ['2025-12-31', 1, '2026-01-01'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2025-02-28', 1, '2025-03-01'],
    ['2025-03-11', -45, '2025-01-25'],
    ['2026-03-08', 1, '2026-03-09'], // US DST start
    ['2026-11-01', 1, '2026-11-02'], // US DST end
    ['2026-01-01', 0, '2026-01-01'],
  ])('%s + %i = %s', (iso, n, out) => {
    expect(addDays(iso, n)).toBe(out)
  })
})

describe('localIsoDate', () => {
  it('uses local calendar fields, zero-padded', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localIsoDate(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
  })
})

describe('election day derivation', () => {
  it('subtracts the day offset from the date', () => {
    expect(derivedElectionDay(row({ date: '2025-01-25', daysFromElection: -45 }))).toBe('2025-03-11')
    expect(derivedElectionDay(row({ date: '2025-03-14', daysFromElection: 3 }))).toBe('2025-03-11')
    expect(derivedElectionDay(row({ daysFromElection: null }))).toBeNull()
  })

  it('agrees when every row agrees', () => {
    const days = electionDays([
      row({ election: 'X', date: '2026-10-07', daysFromElection: -27 }),
      row({ election: 'X', date: '2026-11-03', daysFromElection: 0 }),
    ])
    expect(days.get('X')).toBe('2026-11-03')
  })

  it('picks the most common derived date when rows disagree', () => {
    const days = electionDays([
      row({ election: 'X', date: '2026-10-07', daysFromElection: -27 }), // 11-03
      row({ election: 'X', date: '2026-10-08', daysFromElection: -27 }), // 11-04 (typo)
      row({ election: 'X', date: '2026-11-03', daysFromElection: 0 }), // 11-03
    ])
    expect(days.get('X')).toBe('2026-11-03')
  })

  it('breaks ties with the earliest date', () => {
    const days = electionDays([
      row({ election: 'X', date: '2026-11-05', daysFromElection: 0 }),
      row({ election: 'X', date: '2026-11-03', daysFromElection: 0 }),
    ])
    expect(days.get('X')).toBe('2026-11-03')
  })

  it('skips null elections and null offsets', () => {
    const days = electionDays([
      row({ election: null, daysFromElection: -5 }),
      row({ election: 'Y', daysFromElection: null }),
    ])
    expect(days.size).toBe(0)
  })
})

describe('electionOptions', () => {
  const entries = [
    row({ election: 'LATE', date: '2027-05-18', daysFromElection: 0 }),
    row({ election: 'EARLY', date: '2025-02-01', daysFromElection: -38 }),
    row({ election: 'EARLY', date: '2025-03-11', daysFromElection: 0 }),
    row({ election: null, daysFromElection: null }),
    row({ election: 'NODATE', daysFromElection: null }),
  ]

  it('labels each code by Election Day and sorts by date, undated codes last', () => {
    expect(electionOptions(entries)).toEqual([
      { code: 'EARLY', date: '2025-03-11', label: 'March 11, 2025' },
      { code: 'LATE', date: '2027-05-18', label: 'May 18, 2027' },
      { code: 'NODATE', date: null, label: 'NODATE' },
    ])
  })

  it('is empty with no data', () => {
    expect(electionOptions([])).toEqual([])
  })
})

describe('row labels', () => {
  it('labels null elections as cycle-wide and falls back to the code', () => {
    const labels = new Map([['A', 'March 11, 2025']])
    expect(electionLabel(null, labels)).toBe(CYCLE_WIDE_LABEL)
    expect(electionLabel('A', labels)).toBe('March 11, 2025')
    expect(electionLabel('B', labels)).toBe('B')
  })

  it.each([
    [-45, 'E−45', '45 days before the election'],
    [-1, 'E−1', '1 day before the election'],
    [0, 'Election Day', 'Election Day'],
    [1, 'E+1', '1 day after the election'],
    [3, 'E+3', '3 days after the election'],
  ])('offset %i', (n, short, long) => {
    expect(offsetLabel(n)).toBe(short)
    expect(offsetDescription(n)).toBe(long)
  })

  it('names every office', () => {
    expect(OFFICE_NAMES).toEqual({
      REC: 'County Recorder',
      BOS: 'Board of Supervisors',
      ELEC: 'Officer in charge of elections',
      SOS: 'Secretary of State',
    })
  })
})
