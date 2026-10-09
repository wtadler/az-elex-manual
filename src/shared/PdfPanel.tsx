import { lazy, Suspense, type CSSProperties } from 'react'
import { usePdfPanel } from './usePdfPanel'

// pdf.js is big, so the viewer (and pdf.js with it) loads only when the panel first opens.
const PdfViewer = lazy(() => import('./pdf/PdfViewer'))

/**
 * The PDF panel. SidePanels places it in the right-hand column (above the statute panel when both
 * are open). Under 900px wide it's a full-screen overlay (see index.css).
 */
export function PdfPanel({ style }: { style?: CSSProperties }) {
  const panel = usePdfPanel()
  if (!panel?.isOpen) return null
  return (
    <section className="pdf-panel" aria-label="Elections Procedures Manual PDF" style={style}>
      <Suspense
        fallback={
          <div className="pdf-viewer">
            <div className="pdf-toolbar">
              <div className="pdf-toolbar-row">
                <span className="pdf-position">Loading the PDF viewer…</span>
                <button type="button" className="pdf-close" onClick={panel.close} aria-label="Close PDF panel">
                  ✕<span className="pdf-close-label"> Close</span>
                </button>
              </div>
            </div>
          </div>
        }
      >
        <PdfViewer target={panel.target} onPageChange={panel.reportPage} onClose={panel.close} />
      </Suspense>
    </section>
  )
}
