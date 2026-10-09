import { PDF_URL } from '../../shared/citation'

export function Home() {
  return (
    <section>
      <h2>The Arizona Elections Procedures Manual, easier to use</h2>
      <p>
        An unofficial companion to the{' '}
        <a href={PDF_URL} target="_blank" rel="noreferrer">2025 Arizona Elections Procedures Manual</a>{' '}
        (EPM). Every rule links back to its page in the manual and to the statute.
      </p>
      <ul className="home-links">
        <li><a href="#/calendar">Calendar</a>: deadlines by election and office</li>
        <li><a href="#/ballot-guide">Ballot guide</a>: which ballot a voter gets at check-in</li>
        <li><a href="#/manual">Manual</a>: browse and search the EPM</li>
      </ul>
      <p className="help">
        Not an official Secretary of State product. The manual is the authority; check it before acting.
      </p>
    </section>
  )
}
