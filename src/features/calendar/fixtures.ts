import type { CalendarEntry } from '../../shared/types'

/** Test row builder. Values are invented, not taken from the manual. */
export function row(over: Partial<CalendarEntry> = {}): CalendarEntry {
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
  }
}
