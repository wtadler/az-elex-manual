import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { epmPdfUrl, PDF_URL } from '../citation'
import { parseGoToPage, pdfToPrintedPage, printedPageLabel, printedToPdfPage } from '../pdfPages'
import { loadEpmDocument, type EpmDocument } from './epmDocument'
import { clampScale, computeLayout, fitWidthScale, pageAtOffset, type PdfLayout } from './pdfLayout'
import { PdfPageView } from './PdfPageView'

export interface PdfViewerProps {
  /** PDF page to scroll to; a new nonce scrolls again even if the page is the same. */
  target: { pdfPage: number; nonce: number }
  onPageChange: (pdfPage: number) => void
  onClose: () => void
}

const ZOOM_STEP = 1.2

function visiblePages(first: number, last: number): number[] {
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i)
}

/** The PDF panel's contents: toolbar plus a lazily rendered, scrollable column of pages. */
export default function PdfViewer({ target, onPageChange, onClose }: PdfViewerProps) {
  const [epm, setEpm] = useState<EpmDocument | null>(null)
  const [loadError, setLoadError] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [view, setView] = useState({ top: 0, height: 0 })
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [goTo, setGoTo] = useState('')
  const [goToError, setGoToError] = useState(false)

  useEffect(() => {
    let alive = true
    loadEpmDocument().then(
      (d) => alive && setEpm(d),
      (err: unknown) => {
        console.error(err)
        if (alive) setLoadError(true)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  // Track the scroller's size. Width changes (panel resize) settle briefly before pages re-render.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    let timer: number | undefined
    let first = true
    const ro = new ResizeObserver(() => {
      setView({ top: el.scrollTop, height: el.clientHeight })
      window.clearTimeout(timer)
      if (first) setWidth(el.clientWidth)
      else timer = window.setTimeout(() => setWidth(el.clientWidth), 120)
      first = false
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      window.clearTimeout(timer)
    }
  }, [])

  const sizes = epm?.sizes
  const scale = useMemo(() => {
    if (!sizes || !width) return 0
    return zoom === 'fit' ? fitWidthScale(width, sizes) : zoom
  }, [sizes, width, zoom])
  const layout = useMemo(() => (sizes && scale ? computeLayout(sizes, scale) : null), [sizes, scale])
  const pageCount = sizes?.length ?? 0

  const scrollToPage = (pdfPage: number, l: PdfLayout | null = layout) => {
    const el = scroller.current
    if (!el || !l) return
    const i = Math.min(Math.max(pdfPage, 1), l.tops.length) - 1
    el.scrollTop = l.tops[i] - 8
    setView({ top: el.scrollTop, height: el.clientHeight })
  }

  // Scroll to each new target once there's a layout. On zoom or resize, keep the same spot in view.
  const pendingTarget = useRef<number | null>(target.pdfPage)
  const lastNonce = useRef(target.nonce)
  const prevLayout = useRef<PdfLayout | null>(null)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || !layout) return
    if (lastNonce.current !== target.nonce) {
      lastNonce.current = target.nonce
      pendingTarget.current = target.pdfPage
    }
    const prev = prevLayout.current
    prevLayout.current = layout
    if (pendingTarget.current != null) {
      scrollToPage(pendingTarget.current, layout)
      pendingTarget.current = null
    } else if (prev && prev !== layout) {
      const page = pageAtOffset(prev, el.scrollTop) - 1
      const fraction = (el.scrollTop - prev.tops[page]) / (prev.heights[page] || 1)
      el.scrollTop = layout.tops[page] + fraction * layout.heights[page]
      setView({ top: el.scrollTop, height: el.clientHeight })
    }
    // scrollToPage is recreated each render; layout and the target are the real triggers.
  }, [layout, target.nonce, target.pdfPage])

  // The "current" page is the one under a line a quarter of the way down the panel.
  const current = layout ? pageAtOffset(layout, view.top + view.height * 0.25) : target.pdfPage
  useEffect(() => {
    if (layout) onPageChange(current)
  }, [current, layout, onPageChange])

  // Only pages within a screen of the viewport are mounted; the container keeps the full height,
  // computed from every page's viewport, so the scroll position never jumps.
  const [first, last] = layout
    ? [pageAtOffset(layout, view.top - view.height), pageAtOffset(layout, view.top + view.height * 2)]
    : [1, 0]

  // Prev/next step from the live scroll position, so quick repeated clicks don't reuse a stale page.
  const step = (delta: number) => {
    const el = scroller.current
    if (!el || !layout) return
    scrollToPage(pageAtOffset(layout, el.scrollTop + el.clientHeight * 0.25) + delta)
  }
  const changeZoom = (next: 'fit' | number) => setZoom(next === 'fit' ? 'fit' : clampScale(next))
  const onGoTo = (e: FormEvent) => {
    e.preventDefault()
    const printed = parseGoToPage(goTo, pageCount ? pdfToPrintedPage(pageCount) ?? 1 : undefined)
    setGoToError(printed == null)
    if (printed != null) scrollToPage(printedToPdfPage(printed, pageCount || undefined))
  }

  const printed = pdfToPrintedPage(current)
  return (
    <div className="pdf-viewer">
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-row">
          <button type="button" onClick={() => step(-1)} disabled={!layout || current <= 1} aria-label="Previous page">
            ‹
          </button>
          <span className="pdf-position" aria-live="polite">
            <strong>{printedPageLabel(current)}</strong>{' '}
            <span className="pdf-muted">
              PDF {current}
              {pageCount ? ` of ${pageCount}` : ''}
            </span>
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!layout || current >= pageCount}
            aria-label="Next page"
          >
            ›
          </button>
          <button type="button" className="pdf-close" onClick={onClose} aria-label="Close PDF panel">
            ✕<span className="pdf-close-label"> Close</span>
          </button>
        </div>
        <div className="pdf-toolbar-row">
          <form className="pdf-goto" onSubmit={onGoTo}>
            <label>
              Go to EPM p.{' '}
              <input
                value={goTo}
                onChange={(e) => {
                  setGoTo(e.target.value)
                  setGoToError(false)
                }}
                inputMode="numeric"
                size={4}
                placeholder={printed ? String(printed) : '1'}
                aria-invalid={goToError || undefined}
                title={goToError ? 'Enter a printed page number, like 211' : undefined}
              />
            </label>
            <button type="submit" disabled={!layout}>Go</button>
          </form>
          <div className="pdf-zoom" role="group" aria-label="Zoom">
            <button type="button" onClick={() => changeZoom(scale / ZOOM_STEP)} disabled={!scale} aria-label="Zoom out">
              −
            </button>
            <button type="button" onClick={() => changeZoom('fit')} aria-pressed={zoom === 'fit'} disabled={!scale}>
              Fit width
            </button>
            <button type="button" onClick={() => changeZoom(scale * ZOOM_STEP)} disabled={!scale} aria-label="Zoom in">
              +
            </button>
          </div>
          <a href={printed ? epmPdfUrl(printed) : `${PDF_URL}#page=${current}`} target="_blank" rel="noreferrer">
            Open PDF in new tab ↗
          </a>
        </div>
      </div>
      <div
        ref={scroller}
        className="pdf-scroller"
        onScroll={(e) => setView({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}
      >
        {loadError ? (
          <p className="pdf-status">
            Couldn't load the manual.{' '}
            <a href={PDF_URL} target="_blank" rel="noreferrer">
              Open the PDF in a new tab
            </a>
            .
          </p>
        ) : !layout || !epm ? (
          <p className="pdf-status">Loading the manual…</p>
        ) : (
          <div className="pdf-pages" style={{ height: layout.total, width: Math.max(...layout.widths) + 24 }}>
            {visiblePages(first, last).map((n) => (
              <div
                key={n}
                className="pdf-page"
                style={{ top: layout.tops[n - 1], width: layout.widths[n - 1], height: layout.heights[n - 1] }}
                data-page={n}
              >
                <PdfPageView doc={epm.doc} pageNumber={n} scale={scale} onGoToPage={scrollToPage} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
