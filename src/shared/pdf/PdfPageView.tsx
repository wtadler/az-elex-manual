import {
  RenderingCancelledException,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import { PDF_URL } from '../citation'
import { isPlainClick } from '../clicks'
import { statuteLabel } from '../statutes/ref'
import { useStatutePanel } from '../useStatutePanel'
import { classifyLink, destPageRef, linkBox, type LinkTarget, type PercentBox } from './pdfLinks'

interface Props {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
  /** Jumps the viewer to a PDF page (for the manual's internal links, like the table of contents). */
  onGoToPage: (pdfPage: number) => void
}

interface PageLink {
  box: PercentBox
  target: LinkTarget
  /** Resolved PDF page for internal links. */
  pdfPage?: number
}

/** 1-based PDF page an internal link's destination points to, or null if it can't be resolved. */
async function resolveDest(doc: PDFDocumentProxy, dest: string | unknown[]): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest
    const ref = explicit ? destPageRef(explicit) : null
    if (ref == null) return null
    return (typeof ref === 'number' ? ref : await doc.getPageIndex(ref)) + 1
  } catch {
    return null
  }
}

/** The page's link annotations, placed as percentages of the page so they hold at any zoom. */
async function loadLinks(doc: PDFDocumentProxy, pageNumber: number): Promise<PageLink[]> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const annotations = (await page.getAnnotations({ intent: 'display' })) as Parameters<typeof classifyLink>[0][]
  const links = await Promise.all(
    annotations.map(async (a): Promise<PageLink | null> => {
      const target = classifyLink(a)
      const box = target && a.rect ? linkBox(a.rect, (x, y) => viewport.convertToViewportPoint(x, y), viewport) : null
      if (!target || !box) return null
      if (target.kind !== 'dest') return { box, target }
      const pdfPage = await resolveDest(doc, target.dest)
      return pdfPage == null ? null : { box, target, pdfPage }
    }),
  )
  return links.filter((l): l is PageLink => l != null)
}

/**
 * Draws one page (canvas plus selectable text layer) into its sized box. Each render gets a fresh
 * canvas that replaces the old one only when it's done, so zooming never flashes a blank page.
 */
export function PdfPageView({ doc, pageNumber, scale, onGoToPage }: Props) {
  const canvasHost = useRef<HTMLDivElement>(null)
  const textHost = useRef<HTMLDivElement>(null)
  const statutes = useStatutePanel()
  const [links, setLinks] = useState<PageLink[]>([])

  // Links don't depend on zoom (boxes are percentages), so load them once per page.
  useEffect(() => {
    let alive = true
    loadLinks(doc, pageNumber).then(
      (l) => alive && setLinks(l),
      (err: unknown) => console.error(err),
    )
    return () => {
      alive = false
    }
  }, [doc, pageNumber])

  useEffect(() => {
    let cancelled = false
    let task: RenderTask | null = null
    let textLayer: TextLayer | null = null
    let page: PDFPageProxy | null = null
    let pending: HTMLCanvasElement | null = null

    doc.getPage(pageNumber).then((p) => {
      page = p
      if (cancelled || !canvasHost.current || !textHost.current) return
      const viewport = p.getViewport({ scale })
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const canvas = document.createElement('canvas')
      pending = canvas
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      task = p.render({
        canvas,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      })
      task.promise.then(
        () => {
          if (cancelled) return
          pending = null
          const old = canvasHost.current?.querySelector('canvas')
          canvasHost.current?.replaceChildren(canvas)
          if (old) old.width = old.height = 0 // release the replaced bitmap now (iOS caps canvas memory)
        },
        (err: unknown) => {
          if (!(err instanceof RenderingCancelledException)) console.error(err)
        },
      )

      const host = textHost.current
      host.replaceChildren()
      host.style.setProperty('--total-scale-factor', String(scale))
      textLayer = new TextLayer({ textContentSource: p.streamTextContent(), container: host, viewport })
      textLayer.render().catch(() => {}) // cancelled on unmount or zoom
    })

    return () => {
      cancelled = true
      task?.cancel()
      textLayer?.cancel()
      if (pending) pending.width = pending.height = 0
      page?.cleanup() // drop pdf.js's cached drawing data for pages scrolled away from
    }
  }, [doc, pageNumber, scale])

  return (
    <>
      <div ref={canvasHost} className="pdf-canvas" />
      <div ref={textHost} className="textLayer" />
      <div className="pdf-links">
        {links.map((l, i) => {
          const style = { left: `${l.box.left}%`, top: `${l.box.top}%`, width: `${l.box.width}%`, height: `${l.box.height}%` }
          const t = l.target
          if (t.kind === 'dest') {
            const n = l.pdfPage ?? 1
            return (
              <a
                key={i}
                href={`${PDF_URL}#page=${n}`}
                style={style}
                aria-label={`Go to PDF page ${n}`}
                onClick={(e) => {
                  if (!isPlainClick(e)) return
                  e.preventDefault()
                  onGoToPage(n)
                }}
              />
            )
          }
          return (
            <a
              key={i}
              href={t.url}
              target="_blank"
              rel="noreferrer"
              style={style}
              aria-label={t.kind === 'statute' ? statuteLabel(t.id) : t.url}
              title={t.kind === 'statute' ? statuteLabel(t.id) : t.url}
              onClick={(e) => {
                if (t.kind !== 'statute' || !statutes || !isPlainClick(e)) return
                e.preventDefault()
                statutes.openStatute(t.id)
              }}
            />
          )
        })}
      </div>
    </>
  )
}
