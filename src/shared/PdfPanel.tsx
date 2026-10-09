import { lazy, Suspense, useEffect, useState, type CSSProperties, type PointerEvent } from 'react'
import { usePdfPanel } from './usePdfPanel'

// pdf.js is big, so the viewer (and pdf.js with it) loads only when the panel first opens.
const PdfViewer = lazy(() => import('./pdf/PdfViewer'))

const MIN_WIDTH = 320

/**
 * The PDF panel the app shell renders beside the content. Desktop: a resizable right-hand column.
 * Under 900px wide: a full-screen overlay (see index.css).
 */
export function PdfPanel() {
  const panel = usePdfPanel()
  const [width, setWidth] = useState<number | null>(null)
  const isOpen = panel?.isOpen ?? false
  const close = panel?.close

  useEffect(() => {
    if (!isOpen || !close) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  if (!panel?.isOpen) return null

  const onResizeStart = (e: PointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const onMove = (ev: globalThis.PointerEvent) => {
      const max = window.innerWidth - MIN_WIDTH
      setWidth(Math.round(Math.min(max, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX))))
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  return (
    <aside
      className="pdf-panel"
      aria-label="Elections Procedures Manual PDF"
      style={width ? ({ '--pdf-panel-width': `${width}px` } as CSSProperties) : undefined}
    >
      <div
        className="pdf-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize PDF panel"
        onPointerDown={onResizeStart}
      />
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
    </aside>
  )
}
