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
    ['GOV office', { ...DEFAULT_STATE, offices: ['GOV'] }],
    ['search with spaces and symbols', { ...DEFAULT_STATE, query: 'early & 16-542(C), "ballot"?#' }],
    ['view and window', { ...DEFAULT_STATE, view: 'upcoming', days: 90 }],
    ['view all', { ...DEFAULT_STATE, view: 'all' }],
    ['month view', { ...DEFAULT_STATE, view: 'month' }],
    ['month view at a month', { ...DEFAULT_STATE, view: 'month', month: '2026-10' }],
    ['month view with a selected day', { ...DEFAULT_STATE, view: 'month', month: '2026-10', day: '2026-10-20' }],
    [
      'everything',
      {
        election: 'MAR_NEXT',
        offices: ['REC', 'BOS', 'ELEC', 'SOS', 'GOV'],
        query: 'canvass',
        view: 'all',
        days: 7,
        month: '2027-03',
        day: '2027-03-09',
      },
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
    expect(parseCalendarHash('#/calendar?office=GOV,REC').offices).toEqual(['REC', 'GOV'])
  })

  it('drops invalid values', () => {
    const s = parseCalendarHash('#/calendar?office=REC,XYZ,,rec&view=week&days=13')
    expect(s.offices).toEqual(['REC'])
    expect(s.view).toBeNull()
    expect(s.days).toBe(14)
  })

  it('writes a readable month link', () => {
    expect(calendarHash({ ...DEFAULT_STATE, view: 'month', month: '2026-10', day: '2026-10-20' })).toBe(
      '#/calendar?view=month&month=2026-10&day=2026-10-20',
    )
  })

  it.each(['2026-13', '2026-1', 'October', '2026-10-01', ''])('drops an invalid month %j', (m) => {
    expect(parseCalendarHash(`#/calendar?view=month&month=${m}`).month).toBeNull()
  })

  it.each(['2026-10', '2026-13-01', '20261020', 'today', ''])('drops an invalid day %j', (d) => {
    expect(parseCalendarHash(`#/calendar?view=month&day=${d}`).day).toBeNull()
  })
})
