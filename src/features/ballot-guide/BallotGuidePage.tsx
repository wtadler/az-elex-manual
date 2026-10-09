import { useState } from 'react'
import { Cite } from '../../shared/Cite'
import { START, byId } from './tree'

const LABELS = {
  regular: 'Regular ballot',
  'conditional-provisional': 'Conditional provisional ballot',
  provisional: 'Provisional ballot',
  redirect: 'Direct to correct location',
}

// Owner: Person D.
export function BallotGuidePage() {
  const [path, setPath] = useState<string[]>([START])
  const node = byId.get(path[path.length - 1])!

  return (
    <section>
      <h2>Which ballot does this voter get?</h2>
      <p className="notice">Sample tree: incomplete. Not for use at a voting location.</p>

      {node.kind === 'question' ? (
        <div className="card">
          <p className="question">{node.text}</p>
          {node.help && <p className="help">{node.help}</p>}
          <div className="options">
            {node.options.map((o) => (
              <button key={o.label} onClick={() => setPath([...path, o.next])}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="cites">{node.cites.map((c, i) => <Cite key={i} {...c} />)}</p>
        </div>
      ) : (
        <div className={`card outcome outcome-${node.ballot}`}>
          <p className="outcome-label">{LABELS[node.ballot]}</p>
          <p>{node.text}</p>
          <p className="cites">{node.cites.map((c, i) => <Cite key={i} {...c} />)}</p>
        </div>
      )}

      <div className="options">
        {path.length > 1 && <button onClick={() => setPath(path.slice(0, -1))}>Back</button>}
        {path.length > 1 && <button onClick={() => setPath([START])}>Start over</button>}
      </div>
    </section>
  )
}
