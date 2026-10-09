import calendar from '../../data/calendar.json'
import { Cite } from '../../shared/Cite'
import type { CalendarEntry } from '../../shared/types'

// Owner: Person C. Data comes from src/data/calendar.json (owned by Person B).
// TODO: filter by election and office, "due in the next 14 days," and calendar export.
const entries = calendar as CalendarEntry[]

export function CalendarPage() {
  return (
    <section>
      <h2>Election calendar</h2>
      <p className="notice">Showing {entries.length} sample rows until the full calendar is parsed.</p>
      <ul className="rows">
        {entries.map((e, i) => (
          <li key={i} className="card">
            <div className="row-head">
              <strong>{e.date}</strong>
              <span>{e.election ?? 'All'}</span>
              {e.daysFromElection != null && <span>E{e.daysFromElection >= 0 ? '+' : ''}{e.daysFromElection}</span>}
              {e.offices.map((o) => <span key={o} className="tag">{o}</span>)}
            </div>
            <p>{e.event}</p>
            {e.weekendNote && <p className="help">{e.weekendNote}</p>}
            <p className="cites">
              <Cite epmPage={e.epmPage} />
              {e.statutes.map((s) => <Cite key={s} statute={s} />)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
