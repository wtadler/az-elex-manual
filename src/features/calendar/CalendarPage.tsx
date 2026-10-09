import { useEffect, useMemo, useState } from 'react'
import calendar from '../../data/calendar.json'
import { Cite } from '../../shared/Cite'
import type { CalendarEntry } from '../../shared/types'
import './calendar.css'
import { ALL_ELECTIONS, CYCLE_WIDE, defaultView, filterEntries, groupByMonth, upcoming, type View } from './filter'
import { buildIcs } from './ics'
import {
  type CalendarOffice,
  CYCLE_WIDE_LABEL,
  electionLabel,
  electionOptions,
  formatLongDate,
  localIsoDate,
  OFFICE_NAMES,
  OFFICES,
  offsetDescription,
  offsetLabel,
} from './labels'
import { calendarHash, parseCalendarHash, WINDOW_OPTIONS, type CalendarState } from './query'

// Owner: Person C. Data comes from src/data/calendar.json (owned by Person B).
const entries = calendar as CalendarEntry[]
const elections = electionOptions(entries)
const electionLabels = new Map(elections.map((o) => [o.code, o.label]))

function useCalendarState(): [CalendarState, (s: CalendarState) => void] {
  const [state, setState] = useState(() => parseCalendarHash(window.location.hash))
  useEffect(() => {
    // Pasted or edited links arrive as hashchange; our own updates use replaceState.
    const onChange = () => setState(parseCalendarHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const update = (next: CalendarState) => {
    setState(next)
    const hash = calendarHash(next)
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }
  return [state, update]
}

function download(rows: CalendarEntry[]) {
  const ics = buildIcs(rows, { baseUrl: window.location.href, now: new Date(), electionLabels })
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'arizona-election-calendar.ics'
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function CalendarPage() {
  const [state, setState] = useCalendarState()
  const [today] = useState(() => localIsoDate(new Date()))

  const filtered = useMemo(() => filterEntries(entries, state), [state])
  const view: View = state.view ?? defaultView(filtered, today, state.days)
  const rows = view === 'upcoming' ? upcoming(filtered, today, state.days) : filtered
  const groups = groupByMonth(rows)

  const set = (patch: Partial<CalendarState>) => setState({ ...state, ...patch })
  const toggleOffice = (o: CalendarOffice) =>
    set({ offices: state.offices.includes(o) ? state.offices.filter((x) => x !== o) : [...state.offices, o] })
  const filtersOn = state.election !== ALL_ELECTIONS || state.offices.length > 0 || state.query !== ''

  return (
    <section className="calendar">
      <h2>Election calendar</h2>
      <p className="help">
        Deadlines from Chapter 15 of the 2025 Elections Procedures Manual. Check the manual and statutes before
        relying on a date.
      </p>

      <form className="cal-filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="cal-field">
          <span>Election</span>
          <select value={state.election} onChange={(e) => set({ election: e.target.value })}>
            <option value={ALL_ELECTIONS}>All</option>
            {elections.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
            <option value={CYCLE_WIDE}>{CYCLE_WIDE_LABEL}</option>
          </select>
        </label>

        <label className="cal-field">
          <span>Search events and statutes</span>
          <input
            type="search"
            value={state.query}
            placeholder="e.g. early ballot, 16-542"
            onChange={(e) => set({ query: e.target.value })}
          />
        </label>

        <fieldset className="cal-offices">
          <legend>Office</legend>
          {OFFICES.map((o) => (
            <label key={o} className="cal-chip">
              <input type="checkbox" checked={state.offices.includes(o)} onChange={() => toggleOffice(o)} />
              {OFFICE_NAMES[o]}
            </label>
          ))}
        </fieldset>

        {filtersOn && (
          <button type="button" onClick={() => set({ election: ALL_ELECTIONS, offices: [], query: '' })}>
            Clear filters
          </button>
        )}
      </form>

      <div className="cal-toolbar">
        <div className="cal-views" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'upcoming'} onClick={() => set({ view: 'upcoming' })}>
            Upcoming
          </button>
          <button type="button" aria-pressed={view === 'all'} onClick={() => set({ view: 'all' })}>
            All dates
          </button>
        </div>
        {view === 'upcoming' && (
          <label className="cal-window">
            Next{' '}
            <select value={state.days} onChange={(e) => set({ view: 'upcoming', days: Number(e.target.value) })}>
              {WINDOW_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="cal-download" disabled={rows.length === 0} onClick={() => download(rows)}>
          Download .ics
        </button>
      </div>

      <p className="help" aria-live="polite">
        {rows.length === 0
          ? 'No dates match.'
          : `Showing ${rows.length} ${rows.length === 1 ? 'date' : 'dates'}${
              view === 'upcoming' ? ` from today through the next ${state.days} days` : ''
            }.`}
        {rows.length === 0 && view === 'upcoming' && filtered.length > 0 && (
          <>
            {' '}
            <button type="button" className="cal-link" onClick={() => set({ view: 'all' })}>
              Show all {filtered.length} matching dates
            </button>
          </>
        )}
      </p>

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`cal-${g.key}`}>
          <h3 id={`cal-${g.key}`} className="cal-month">
            {g.label}
          </h3>
          <ul className="rows">
            {g.entries.map((e, i) => (
              <EntryCard key={`${e.date}-${i}`} entry={e} />
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}

function EntryCard({ entry: e }: { entry: CalendarEntry }) {
  return (
    <li className="card cal-entry">
      <div className="row-head">
        <time dateTime={e.date}>
          <strong>{formatLongDate(e.date)}</strong>
        </time>
        <span className="cal-election">
          {electionLabel(e.election, electionLabels)}
          {e.election != null && ' election'}
        </span>
        {e.daysFromElection != null && (
          <span className="cal-offset" title={offsetDescription(e.daysFromElection)}>
            <span aria-hidden="true">{offsetLabel(e.daysFromElection)}</span>
            <span className="sr-only">{offsetDescription(e.daysFromElection)}</span>
          </span>
        )}
      </div>
      {e.offices.length > 0 && (
        <ul className="cal-tags" aria-label="Offices">
          {e.offices.map((o) => (
            <li key={o} className="tag" title={OFFICE_NAMES[o]}>
              <span aria-hidden="true">{o}</span>
              <span className="sr-only">{OFFICE_NAMES[o]}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="cal-event">{e.event}</p>
      {e.weekendNote && <p className="help cal-note">{e.weekendNote}</p>}
      <p className="cites">
        <Cite epmPage={e.epmPage} />
        {e.statutes.map((s) => (
          <Cite key={s} statute={s} />
        ))}
      </p>
    </li>
  )
}
