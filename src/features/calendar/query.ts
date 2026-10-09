import { ALL_ELECTIONS, type Filters, type View } from './filter'
import type { Office } from '../../shared/types'
import { OFFICES } from './labels'
import { isMonthKey } from './month'

// Calendar state <-> hash query, so a filtered view is a shareable link:
// #/calendar?election=NOV_EV&office=REC,BOS&q=early&view=all&days=30
// #/calendar?view=month&month=2026-10&day=2026-10-20

export const WINDOW_OPTIONS = [7, 14, 30, 90] as const
export const DEFAULT_WINDOW = 14

export interface CalendarState extends Filters {
  /** Null means "not chosen": use the default view. */
  view: View | null
  /** Upcoming window in days; one of WINDOW_OPTIONS. */
  days: number
  /** Month view: "YYYY-MM" shown, or null for the default month. */
  month: string | null
  /** Month view: selected ISO date whose rows are listed under the grid, or null. */
  day: string | null
}

export const DEFAULT_STATE: CalendarState = {
  election: ALL_ELECTIONS,
  offices: [],
  query: '',
  view: null,
  days: DEFAULT_WINDOW,
  month: null,
  day: null,
}

/** Reads calendar state from a location hash. Unknown or invalid values fall back to defaults. */
export function parseCalendarHash(hash: string): CalendarState {
  const i = hash.indexOf('?')
  const params = new URLSearchParams(i < 0 ? '' : hash.slice(i + 1))
  const offices = (params.get('office') ?? '')
    .split(',')
    .filter((o): o is Office => (OFFICES as string[]).includes(o))
  const view = params.get('view')
  const days = Number(params.get('days'))
  const month = params.get('month') ?? ''
  const day = params.get('day') ?? ''
  return {
    election: params.get('election') ?? ALL_ELECTIONS,
    offices: OFFICES.filter((o) => offices.includes(o)),
    query: params.get('q') ?? '',
    view: view === 'upcoming' || view === 'all' || view === 'month' ? view : null,
    days: (WINDOW_OPTIONS as readonly number[]).includes(days) ? days : DEFAULT_WINDOW,
    month: isMonthKey(month) ? month : null,
    day: /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) ? day : null,
  }
}

/** Hash for a calendar state, leaving out defaults: "#/calendar" when nothing is set. */
export function calendarHash(s: CalendarState): string {
  const params = new URLSearchParams()
  if (s.election !== ALL_ELECTIONS) params.set('election', s.election)
  if (s.offices.length) params.set('office', OFFICES.filter((o) => s.offices.includes(o)).join(','))
  if (s.query) params.set('q', s.query)
  if (s.view) params.set('view', s.view)
  if (s.days !== DEFAULT_WINDOW) params.set('days', String(s.days))
  if (s.month) params.set('month', s.month)
  if (s.day) params.set('day', s.day)
  const q = params.toString().replaceAll('%2C', ',')
  return q ? `#/calendar?${q}` : '#/calendar'
}
