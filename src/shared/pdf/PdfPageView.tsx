import {
  RenderingCancelledException,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist'
import { useEffect, useRef } from 'react'

interface Props {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
}

/**
 * Draws one page (canvas plus selectable text layer) into its sized box. Each render gets a fresh
 * canvas that replaces the old one only when it's done, so zooming never flashes a blank page.
 */
export function PdfPageView({ doc, pageNumber, scale }: Props) {
  const canvasHost = useRef<HTMLDivElement>(null)
  const textHost = useRef<HTMLDivElement>(null)

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
    </>
  )
}
