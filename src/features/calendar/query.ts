import { ALL_ELECTIONS, type Filters, type View } from './filter'
import type { Office } from '../../shared/types'
import { OFFICES } from './labels'

// Calendar state <-> hash query, so a filtered view is a shareable link:
// #/calendar?election=NOV_EV&office=REC,BOS&q=early&view=all&days=30

export const WINDOW_OPTIONS = [7, 14, 30, 90] as const
export const DEFAULT_WINDOW = 14

export interface CalendarState extends Filters {
  /** Null means "not chosen": use the default view. */
  view: View | null
  /** Upcoming window in days; one of WINDOW_OPTIONS. */
  days: number
}

export const DEFAULT_STATE: CalendarState = {
  election: ALL_ELECTIONS,
  offices: [],
  query: '',
  view: null,
  days: DEFAULT_WINDOW,
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
  return {
    election: params.get('election') ?? ALL_ELECTIONS,
    offices: OFFICES.filter((o) => offices.includes(o)),
    query: params.get('q') ?? '',
    view: view === 'upcoming' || view === 'all' ? view : null,
    days: (WINDOW_OPTIONS as readonly number[]).includes(days) ? days : DEFAULT_WINDOW,
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
  const q = params.toString().replaceAll('%2C', ',')
  return q ? `#/calendar?${q}` : '#/calendar'
}
