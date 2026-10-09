import { PDF_URL } from '../../shared/citation'
import { PdfPageLink } from '../../shared/PdfPageLink'
import { usePdfPanel } from '../../shared/usePdfPanel'

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
  const pdf = usePdfPanel()
  return (
    <section>
      <h2>Browse the manual</h2>
      <p>
        {pdf && (
          <>
            <button type="button" onClick={pdf.open}>
              Browse the PDF here
            </button>{' '}
          </>
        )}
        <a href={PDF_URL} target="_blank" rel="noreferrer">Open the full PDF in a new tab</a> (2025 EPM, 479 pages)
      </p>
      <p className="help">Pick a chapter to open the manual at its first page.</p>
      <ol className="chapters">
        {CHAPTERS.map(([title, page]) => (
          <li key={title}>
            <PdfPageLink printedPage={page}>{title}</PdfPageLink>
            <span className="chapter-page">p.&nbsp;{page}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
