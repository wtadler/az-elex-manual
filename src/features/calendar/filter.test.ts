import { describe, expect, it } from 'vitest'
import {
  ALL_ELECTIONS,
  CYCLE_WIDE,
  defaultView,
  filterEntries,
  groupByMonth,
  NO_FILTERS,
  upcoming,
} from './filter'
import { row } from './fixtures'

const a = row({ date: '2026-01-10', election: 'A', offices: ['REC'], event: 'Early voting begins', statutes: ['16-542(C)'] })
const b = row({ date: '2026-02-10', election: 'B', offices: ['BOS', 'ELEC'], event: 'Canvass deadline', statutes: ['16-642(A)'] })
const c = row({ date: '2026-03-10', election: null, daysFromElection: null, offices: ['SOS'], event: 'Publish candidate guide', statutes: ['Procedures Manual'] })
const d = row({ date: '2026-04-10', election: 'A', offices: [], event: 'Election Day', statutes: ['16-204'] })
const all = [a, b, c, d]

describe('filterEntries', () => {
  it('returns everything with no filters', () => {
    expect(filterEntries(all, NO_FILTERS)).toEqual(all)
  })

  describe('election', () => {
    it('keeps only the chosen code', () => {
      expect(filterEntries(all, { ...NO_FILTERS, election: 'A' })).toEqual([a, d])
    })

    it('excludes cycle-wide rows when a specific election is chosen', () => {
      expect(filterEntries(all, { ...NO_FILTERS, election: 'B' })).toEqual([b])
    })

    it('selects null-election rows with CYCLE_WIDE', () => {
      expect(filterEntries(all, { ...NO_FILTERS, election: CYCLE_WIDE })).toEqual([c])
    })

    it('keeps null-election rows under ALL_ELECTIONS', () => {
      expect(filterEntries(all, { ...NO_FILTERS, election: ALL_ELECTIONS })).toContain(c)
    })

    it('matches nothing for an unknown code', () => {
      expect(filterEntries(all, { ...NO_FILTERS, election: 'NOPE' })).toEqual([])
    })
  })

  describe('office', () => {
    it('keeps rows with the one chosen office', () => {
      expect(filterEntries(all, { ...NO_FILTERS, offices: ['REC'] })).toEqual([a])
    })

    it('treats multiple offices as "any of"', () => {
      expect(filterEntries(all, { ...NO_FILTERS, offices: ['REC', 'SOS'] })).toEqual([a, c])
    })

    it('matches a row with several offices on any one', () => {
      expect(filterEntries(all, { ...NO_FILTERS, offices: ['ELEC'] })).toEqual([b])
    })

    it('filters on GOV (Governor)', () => {
      const gov = row({ date: '2026-05-01', election: 'A', offices: ['GOV'], event: 'Proclamation' })
      expect(filterEntries([...all, gov], { ...NO_FILTERS, offices: ['GOV'] })).toEqual([gov])
      expect(filterEntries([...all, gov], { ...NO_FILTERS, offices: ['GOV', 'REC'] })).toEqual([a, gov])
      expect(filterEntries(all, { ...NO_FILTERS, offices: ['GOV'] })).toEqual([])
    })

    it('matches an "ALL" row (all four county/state offices) on any one of them', () => {
      const every = row({ offices: ['REC', 'BOS', 'ELEC', 'SOS'], event: 'Everyone' })
      for (const o of ['REC', 'BOS', 'ELEC', 'SOS'] as const) {
        expect(filterEntries([every], { ...NO_FILTERS, offices: [o] })).toEqual([every])
      }
      expect(filterEntries([every], { ...NO_FILTERS, offices: ['GOV'] })).toEqual([])
    })

    it('drops rows with no office when an office filter is on', () => {
      expect(filterEntries(all, { ...NO_FILTERS, offices: ['REC', 'BOS', 'ELEC', 'SOS', 'GOV'] })).toEqual([a, b, c])
    })
  })

  describe('search', () => {
    it('matches the event text, case-insensitively', () => {
      expect(filterEntries(all, { ...NO_FILTERS, query: 'EARLY voting' })).toEqual([a])
      expect(filterEntries(all, { ...NO_FILTERS, query: 'canvass' })).toEqual([b])
    })

    it('matches statutes', () => {
      expect(filterEntries(all, { ...NO_FILTERS, query: '16-642' })).toEqual([b])
      expect(filterEntries(all, { ...NO_FILTERS, query: 'procedures manual' })).toEqual([c])
    })

    it('requires every word but in any field and order', () => {
      expect(filterEntries(all, { ...NO_FILTERS, query: 'begins 16-542' })).toEqual([a])
      expect(filterEntries(all, { ...NO_FILTERS, query: 'begins canvass' })).toEqual([])
    })

    it('ignores surrounding and repeated whitespace', () => {
      expect(filterEntries(all, { ...NO_FILTERS, query: '   ' })).toEqual(all)
      expect(filterEntries(all, { ...NO_FILTERS, query: '  early   voting ' })).toEqual([a])
    })

    it('treats regex characters literally', () => {
      expect(filterEntries(all, { ...NO_FILTERS, query: '(c)' })).toEqual([a])
      expect(filterEntries(all, { ...NO_FILTERS, query: '.*' })).toEqual([])
    })

    it('returns nothing when nothing matches', () => {
      expect(filterEntries(all, { ...NO_FILTERS, query: 'zzz' })).toEqual([])
    })
  })

  it('combines election, office, and search', () => {
    expect(filterEntries(all, { election: 'A', offices: ['REC'], query: 'early' })).toEqual([a])
    expect(filterEntries(all, { election: 'A', offices: ['BOS'], query: '' })).toEqual([])
    expect(filterEntries(all, { election: 'A', offices: [], query: 'election day' })).toEqual([d])
    expect(filterEntries(all, { election: CYCLE_WIDE, offices: ['SOS'], query: 'guide' })).toEqual([c])
    expect(filterEntries(all, { election: CYCLE_WIDE, offices: ['REC'], query: '' })).toEqual([])
  })

  it('handles empty input', () => {
    expect(filterEntries([], { election: 'A', offices: ['REC'], query: 'x' })).toEqual([])
  })
})

describe('upcoming', () => {
  const today = '2026-10-09'
  const rows = [
    row({ date: '2026-10-08', event: 'yesterday' }),
    row({ date: '2026-10-09', event: 'today' }),
    row({ date: '2026-10-15', event: 'mid' }),
    row({ date: '2026-10-23', event: 'today+14' }),
    row({ date: '2026-10-24', event: 'today+15' }),
    row({ date: '2025-10-09', event: 'last year' }),
  ]
  const events = (rs: typeof rows) => rs.map((r) => r.event)

  it('includes today and today+N, excludes the past and today+N+1', () => {
    expect(events(upcoming(rows, today, 14))).toEqual(['today', 'mid', 'today+14'])
  })

  it('narrows with a smaller window', () => {
    expect(events(upcoming(rows, today, 7))).toEqual(['today', 'mid'])
    expect(events(upcoming(rows, today, 0))).toEqual(['today'])
  })

  it('widens across a month and year boundary', () => {
    const r = [row({ date: '2027-01-05', event: 'jan' }), row({ date: '2027-01-06', event: 'jan+1' })]
    expect(events(upcoming(r, '2026-12-28', 8))).toEqual(['jan'])
  })

  it('is empty when nothing is in the window', () => {
    expect(upcoming(rows, '2030-01-01', 90)).toEqual([])
  })

  it('defaults to upcoming only when the window has rows', () => {
    expect(defaultView(rows, today, 14)).toBe('upcoming')
    expect(defaultView(rows, '2030-01-01', 14)).toBe('all')
    expect(defaultView([], today, 14)).toBe('all')
  })
})

describe('groupByMonth', () => {
  it('groups by month in date order, across years', () => {
    const rows = [
      row({ date: '2026-01-02', event: '1' }),
      row({ date: '2025-12-31', event: '2' }),
      row({ date: '2025-12-01', event: '3' }),
      row({ date: '2026-01-02', event: '4' }),
      row({ date: '2026-12-15', event: '5' }),
    ]
    const groups = groupByMonth(rows)
    expect(groups.map((g) => [g.key, g.label, g.entries.map((e) => e.event)])).toEqual([
      ['2025-12', 'December 2025', ['3', '2']],
      ['2026-01', 'January 2026', ['1', '4']],
      ['2026-12', 'December 2026', ['5']],
    ])
  })

  it('does not merge the same month in different years', () => {
    const groups = groupByMonth([row({ date: '2025-03-01' }), row({ date: '2026-03-01' })])
    expect(groups.map((g) => g.label)).toEqual(['March 2025', 'March 2026'])
  })

  it('is empty for no rows', () => {
    expect(groupByMonth([])).toEqual([])
  })
})
