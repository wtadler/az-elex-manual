import { describe, expect, it } from 'vitest'
import { routeFromHash } from '../../shared/useHashRoute'
import { CYCLE_WIDE } from './filter'
import { CALENDAR_PARAMS, calendarHash, DEFAULT_STATE, nextCalendarHash, parseCalendarHash, type CalendarState } from './query'

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

describe('nextCalendarHash', () => {
  const state: CalendarState = { ...DEFAULT_STATE, election: 'NOV_EV' }

  it('keeps the PDF panel page', () => {
    expect(nextCalendarHash(state, '#/calendar?pdf=304')).toBe('#/calendar?election=NOV_EV&pdf=304')
  })

  it('keeps unknown params when no calendar params are set', () => {
    expect(nextCalendarHash(DEFAULT_STATE, '#/calendar?office=REC&pdf=211')).toBe('#/calendar?pdf=211')
  })

  it('replaces calendar params rather than duplicating them', () => {
    expect(nextCalendarHash(state, '#/calendar?election=MAR_ODD&office=REC&view=month&pdf=1')).toBe(
      '#/calendar?election=NOV_EV&pdf=1',
    )
  })

  it('matches calendarHash when there is nothing else to keep', () => {
    for (const h of ['', '#', '#/calendar', '#/calendar?', '#/calendar?q=x']) {
      expect(nextCalendarHash(state, h)).toBe(calendarHash(state))
    }
  })

  it('keeps the statute panel ref alongside the PDF page', () => {
    expect(nextCalendarHash(state, '#/calendar?pdf=304&ars=16-579(A)(1)')).toBe(
      '#/calendar?election=NOV_EV&pdf=304&ars=16-579(A)(1)',
    )
    expect(nextCalendarHash(DEFAULT_STATE, '#/calendar?view=month&ars=16-121.01(B)')).toBe('#/calendar?ars=16-121.01(B)')
  })

  it('round-trips the calendar state with pdf and ars params present', () => {
    const full: CalendarState = { ...DEFAULT_STATE, view: 'all', offices: ['REC', 'BOS'], query: 'early' }
    const hash = nextCalendarHash(full, '#/calendar?ars=16-579(A)(1)&pdf=304')
    expect(parseCalendarHash(hash)).toEqual(full)
    expect(hash).toContain('ars=16-579(A)(1)')
  })

  it('round-trips the calendar state with a pdf param present', () => {
    const full: CalendarState = { ...DEFAULT_STATE, view: 'month', month: '2026-10', day: '2026-10-20', offices: ['REC'] }
    expect(parseCalendarHash(nextCalendarHash(full, '#/calendar?pdf=304'))).toEqual(full)
  })
})

describe('CALENDAR_PARAMS', () => {
  it('lists exactly the params calendarHash writes', () => {
    const full: CalendarState = {
      election: 'NOV_EV', offices: ['REC'], query: 'x', view: 'month', days: 7, month: '2026-10', day: '2026-10-20',
    }
    const written = [...new URLSearchParams(calendarHash(full).split('?')[1]).keys()]
    expect(written.sort()).toEqual([...CALENDAR_PARAMS].sort())
  })
})
