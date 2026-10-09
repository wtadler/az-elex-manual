import { Cite } from '../../shared/Cite'
import type { CalendarEntry } from '../../shared/types'
import { electionLabel, formatLongDate, OFFICE_NAMES, offsetDescription, offsetLabel } from './labels'

export function EntryCard({ entry: e, electionLabels }: { entry: CalendarEntry; electionLabels: Map<string, string> }) {
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
