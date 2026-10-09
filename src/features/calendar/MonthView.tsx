import type { CalendarEntry } from '../../shared/types'
import { EntryCard } from './EntryCard'
import { formatLongDate, formatMonth } from './labels'
import { entriesByDate, monthGrid, monthOf, shiftMonth } from './month'

const WEEKDAYS = [
  ['Sun', 'Sunday'],
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
]
/** Event titles shown in a day cell before "+N more". */
const PREVIEW = 2

interface Props {
  /** Rows to show, already filtered to this month. */
  rows: CalendarEntry[]
  month: string
  day: string | null
  today: string
  electionLabels: Map<string, string>
  onMonth: (month: string) => void
  onDay: (day: string | null) => void
}

export function MonthView({ rows, month, day, today, electionLabels, onMonth, onDay }: Props) {
  const byDate = entriesByDate(rows)
  const selected = day && monthOf(day) === month ? day : null
  const selectedRows = selected ? (byDate.get(selected) ?? []) : []
  const title = formatMonth(`${month}-01`)

  return (
    <div className="cal-monthview">
      <div className="cal-monthnav">
        <button type="button" onClick={() => onMonth(shiftMonth(month, -1))} aria-label="Previous month">
          ‹
        </button>
        <h3 className="cal-monthtitle" aria-live="polite">
          {title}
        </h3>
        <button type="button" onClick={() => onMonth(shiftMonth(month, 1))} aria-label="Next month">
          ›
        </button>
        {monthOf(today) !== month && (
          <button type="button" onClick={() => onMonth(monthOf(today))}>
            This month
          </button>
        )}
      </div>

      <table className="cal-grid">
        <caption className="sr-only">Deadlines in {title}. Choose a day to list its deadlines.</caption>
        <thead>
          <tr>
            {WEEKDAYS.map(([short, long]) => (
              <th key={short} scope="col">
                <abbr title={long}>{short}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week) => (
            <tr key={week[0].date}>
              {week.map(({ date, inMonth }) => {
                const items = inMonth ? (byDate.get(date) ?? []) : []
                const classes = [
                  'cal-day',
                  inMonth ? '' : 'cal-day-out',
                  date === today ? 'cal-day-today' : '',
                  date === selected ? 'cal-day-selected' : '',
                ].join(' ')
                const dayNumber = Number(date.slice(8))
                return (
                  <td key={date} className={classes}>
                    {items.length === 0 ? (
                      <span className="cal-daynum" aria-hidden={!inMonth}>
                        {dayNumber}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="cal-daybtn"
                        aria-pressed={date === selected}
                        aria-label={`${formatLongDate(date)}: ${items.length} ${items.length === 1 ? 'deadline' : 'deadlines'}`}
                        onClick={() => onDay(date === selected ? null : date)}
                      >
                        <span className="cal-daynum">{dayNumber}</span>
                        <span className="cal-count">{items.length}</span>
                        <span className="cal-previews" aria-hidden="true">
                          {items.slice(0, PREVIEW).map((e, i) => (
                            <span key={i} className="cal-preview">
                              {e.event}
                            </span>
                          ))}
                          {items.length > PREVIEW && (
                            <span className="cal-more">+{items.length - PREVIEW} more</span>
                          )}
                        </span>
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {selected ? (
        <section aria-labelledby="cal-selected-day">
          <h3 id="cal-selected-day" className="cal-month">
            {formatLongDate(selected)}
          </h3>
          <ul className="rows">
            {selectedRows.map((e, i) => (
              <EntryCard key={i} entry={e} electionLabels={electionLabels} />
            ))}
          </ul>
        </section>
      ) : (
        rows.length > 0 && <p className="help">Choose a day to see its deadlines.</p>
      )}
    </div>
  )
}
