import { lazy, Suspense, type CSSProperties } from 'react'
import { usePdfPanel } from './usePdfPanel'
import { PanelCloseButton } from './PanelCloseButton'

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
                <PanelCloseButton onClose={panel.close} label="Close PDF panel" />
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
