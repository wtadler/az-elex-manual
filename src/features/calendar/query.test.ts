import { describe, expect, it } from 'vitest'
import { routeFromHash } from '../../shared/useHashRoute'
import { CYCLE_WIDE } from './filter'
import { calendarHash, DEFAULT_STATE, parseCalendarHash, type CalendarState } from './query'

describe('calendar hash query', () => {
  it('omits defaults', () => {
    expect(calendarHash(DEFAULT_STATE)).toBe('#/calendar')
    expect(parseCalendarHash('#/calendar')).toEqual(DEFAULT_STATE)
    expect(parseCalendarHash('')).toEqual(DEFAULT_STATE)
  })

  it.each<[string, CalendarState]>([
    ['election only', { ...DEFAULT_STATE, election: 'NOV_EV' }],
    ['cycle-wide', { ...DEFAULT_STATE, election: CYCLE_WIDE }],
    ['offices', { ...DEFAULT_STATE, offices: ['REC', 'SOS'] }],
    ['search with spaces and symbols', { ...DEFAULT_STATE, query: 'early & 16-542(C), "ballot"?#' }],
    ['view and window', { ...DEFAULT_STATE, view: 'upcoming', days: 90 }],
    ['view all', { ...DEFAULT_STATE, view: 'all' }],
    [
      'everything',
      { election: 'MAR_NEXT', offices: ['REC', 'BOS', 'ELEC', 'SOS'], query: 'canvass', view: 'all', days: 7 },
    ],
  ])('round-trips %s', (_, state) => {
    const hash = calendarHash(state)
    expect(routeFromHash(hash)).toBe('calendar')
    expect(parseCalendarHash(hash)).toEqual(state)
  })

  it('writes a readable link', () => {
    expect(
      calendarHash({ ...DEFAULT_STATE, election: 'NOV_EV', offices: ['REC', 'BOS'], query: 'early voting' }),
    ).toBe('#/calendar?election=NOV_EV&office=REC,BOS&q=early+voting')
  })

  it('normalizes office order', () => {
    expect(calendarHash({ ...DEFAULT_STATE, offices: ['SOS', 'REC'] })).toBe('#/calendar?office=REC,SOS')
    expect(parseCalendarHash('#/calendar?office=SOS,REC').offices).toEqual(['REC', 'SOS'])
  })

  it('drops invalid values', () => {
    const s = parseCalendarHash('#/calendar?office=REC,XYZ,,rec&view=week&days=13')
    expect(s.offices).toEqual(['REC'])
    expect(s.view).toBeNull()
    expect(s.days).toBe(14)
  })
})
