import type { CalendarEntry } from '../../shared/types'
import type { CalendarOffice } from './labels'

/** Test row builder. Values are invented, not taken from the manual. */
// Offices are widened to CalendarOffice so tests can use GOV before the shared type has it.
export function row(
  over: Omit<Partial<CalendarEntry>, 'offices'> & { offices?: CalendarOffice[] } = {},
): CalendarEntry {
  return {
    date: '2026-01-15',
    election: 'TEST_A',
    daysFromElection: -10,
    offices: ['REC'],
    event: 'Sample deadline',
    statutes: ['16-100(A)'],
    weekendNote: null,
    epmPage: 304,
    ...over,
  } as CalendarEntry
}
