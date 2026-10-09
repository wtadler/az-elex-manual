import { useEffect, useMemo, useState } from 'react'
import calendar from '../../data/calendar.json'
import notes from '../../data/calendar-notes.json'
import type { CalendarEntry, Office } from '../../shared/types'
import './calendar.css'
import { ALL_ELECTIONS, CYCLE_WIDE, defaultView, filterEntries, groupByMonth, upcoming, type View } from './filter'
import { Cite } from '../../shared/Cite'
import { EntryCard } from './EntryCard'
import { buildIcs } from './ics'
import { defaultMonth, monthOf } from './month'
import { MonthView } from './MonthView'
import { CYCLE_WIDE_LABEL, electionOptions, formatMonth, localIsoDate, OFFICE_NAMES, OFFICES } from './labels'
import { nextCalendarHash, parseCalendarHash, WINDOW_OPTIONS, type CalendarState } from './query'

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
    const hash = nextCalendarHash(next, window.location.hash)
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }
  return [state, update]
}

function download(rows: CalendarEntry[]) {
  const ics = buildIcs(rows, { baseUrl: window.location.href, now: new Date(), electionLabels, footnote: notes.footnote })
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
  const month = state.month ?? defaultMonth(filtered, today)
  const rows =
    view === 'upcoming'
      ? upcoming(filtered, today, state.days)
      : view === 'month'
        ? filtered.filter((e) => monthOf(e.date) === month)
        : filtered
  const groups = groupByMonth(rows)

  const set = (patch: Partial<CalendarState>) => setState({ ...state, ...patch })
  const toggleOffice = (o: Office) =>
    set({ offices: state.offices.includes(o) ? state.offices.filter((x) => x !== o) : [...state.offices, o] })
  const filtersOn = state.election !== ALL_ELECTIONS || state.offices.length > 0 || state.query !== ''

  return (
    <section className="calendar">
      <h2>Election calendar</h2>
      <p className="help">
        Deadlines from Chapter 15 of the 2025 Elections Procedures Manual. Check the manual and statutes before
        relying on a date.
      </p>
      <p className="notice cal-footnote">
        <strong>Weekends and holidays:</strong> the manual's calendar notes, “{notes.footnote}”{' '}
        <Cite epmPage={notes.epmPages[0]} />
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
          <button type="button" aria-pressed={view === 'month'} onClick={() => set({ view: 'month' })}>
            Month
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
          ? view === 'month'
            ? `No dates match in ${formatMonth(`${month}-01`)}.`
            : 'No dates match.'
          : `Showing ${rows.length} ${rows.length === 1 ? 'date' : 'dates'}${
              view === 'upcoming'
                ? ` from today through the next ${state.days} days`
                : view === 'month'
                  ? ` in ${formatMonth(`${month}-01`)}`
                  : ''
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

      {view === 'month' ? (
        <MonthView
          rows={rows}
          month={month}
          day={state.day}
          today={today}
          electionLabels={electionLabels}
          onMonth={(m) => set({ month: m, day: null })}
          onDay={(d) => set({ day: d })}
        />
      ) : (
        groups.map((g) => (
        <section key={g.key} aria-labelledby={`cal-${g.key}`}>
          <h3 id={`cal-${g.key}`} className="cal-month">
            {g.label}
          </h3>
          <ul className="rows">
            {g.entries.map((e, i) => (
              <EntryCard key={`${e.date}-${i}`} entry={e} electionLabels={electionLabels} />
            ))}
          </ul>
        </section>
        ))
      )}
    </section>
  )
}
