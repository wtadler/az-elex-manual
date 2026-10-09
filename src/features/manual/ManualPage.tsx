import { Cite } from '../../shared/Cite'
import { PDF_URL } from '../../shared/citation'

// Owner: Person A (after the shell). Ideas: full-text search over source/epm.txt,
// cross-references as links, a vote center / assigned precinct toggle, a federal-only view.
const CHAPTERS: [string, number][] = [
  ['Voter Registration', 1],
  ['Early Voting', 60],
  ['Ballot-by-Mail Elections', 99],
  ['Voting Equipment', 102],
  ['Accommodating Voters with Disabilities', 123],
  ['Regulation of Petition Circulators', 131],
  ['Presidential Preference Election', 137],
  ['Pre-Election Procedures', 141],
  ['Conduct of Elections/Election Day Operations', 196],
  ['Central Counting Place Procedures', 226],
  ['Hand Count Audit', 249],
  ['Post-Election Day Procedures', 272],
  ['Certifying Election Results', 276],
  ['Campaign Finance', 292],
  ['Election Calendar and Sample Forms', 302],
]

export function ManualPage() {
  return (
    <section>
      <h2>Browse the manual</h2>
      <p>
        <a href={PDF_URL} target="_blank" rel="noreferrer">Open the full PDF</a> (2025 EPM, 479 pages)
      </p>
      <ol className="chapters">
        {CHAPTERS.map(([title, page]) => (
          <li key={title}>
            {title} <Cite epmPage={page} />
          </li>
        ))}
      </ol>
    </section>
  )
}
