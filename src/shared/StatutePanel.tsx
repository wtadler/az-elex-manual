import { lazy, Suspense, type CSSProperties } from 'react'
import { useStatutePanel } from './useStatutePanel'

// Loaded on first open, like the PDF viewer.
const StatuteViewer = lazy(() => import('./statutes/StatuteViewer'))

/**
 * The statute panel. SidePanels places it in the right-hand column, below the PDF panel when both
 * are open. Under 900px wide it's a full-screen overlay on top of the PDF overlay.
 */
export function StatutePanel({ style }: { style?: CSSProperties }) {
  const panel = useStatutePanel()
  if (!panel?.isOpen || !panel.current) return null
  return (
    <section className="statute-panel" aria-label="Arizona statute" style={style}>
      <Suspense
        fallback={
          <div className="statute-viewer">
            <div className="statute-toolbar">
              <span className="statute-heading">Loading the statute…</span>
              <button type="button" className="pdf-close" onClick={panel.close} aria-label="Close statute panel">
                ✕<span className="pdf-close-label"> Close</span>
              </button>
            </div>
          </div>
        }
      >
        <StatuteViewer panel={panel} />
      </Suspense>
    </section>
  )
}
