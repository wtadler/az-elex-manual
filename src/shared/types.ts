// Shared data contracts. Changing these affects every feature: agree as a team first.

/** Where a rule comes from. Every rule shown in the app should carry at least one. */
export interface Citation {
  /** Printed page number in the 2025 EPM (the number in the page footer, not the PDF page). */
  epmPage?: number
  /** Statute as written in the manual, e.g. "16-579(A)(1)" or "52 U.S.C. § 21082(c)". */
  statute?: string
}

/** Office codes from the calendar's CAT 1 / CAT 2 columns. */
export type Office =
  | 'REC' // County Recorder
  | 'BOS' // Board of Supervisors
  | 'ELEC' // Officer in charge of elections
  | 'SOS' // Secretary of State

/** One row of the Chapter 15 election calendar (printed pages 304–320). */
export interface CalendarEntry {
  /** ISO date, e.g. "2026-07-21". */
  date: string
  /** Election code from the calendar, e.g. "NOV_EV", "MAR_ODD". Null for cycle-wide rows. */
  election: string | null
  /** Days before (negative) or after (positive) the election. Null when the row has none. */
  daysFromElection: number | null
  offices: Office[]
  event: string
  /** Statute references as printed, e.g. ["16-542(C)", "16-544(F)"]. May include "Procedures Manual". */
  statutes: string[]
  /** The calendar's "Holiday Weekend Status" note, verbatim, or null. */
  weekendNote: string | null
  /** Printed EPM page the row appears on. */
  epmPage: number
}
