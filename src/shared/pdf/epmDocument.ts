import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDF_URL } from '../citation'
import type { PageSize } from './pdfLayout'

GlobalWorkerOptions.workerSrc = workerUrl

export interface EpmDocument {
  doc: PDFDocumentProxy
  /** Viewport size of every page at scale 1, so placeholders keep the scroll position stable. */
  sizes: PageSize[]
}

let cached: Promise<EpmDocument> | null = null

/** Loads public/epm.pdf once per session; every panel open reuses the same document. */
export function loadEpmDocument(): Promise<EpmDocument> {
  cached ??= load().catch((err: unknown) => {
    cached = null // let the next open retry
    throw err
  })
  return cached
}

async function load(): Promise<EpmDocument> {
  const doc = await getDocument({ url: PDF_URL }).promise
  const sizes = await Promise.all(
    Array.from({ length: doc.numPages }, async (_, i) => {
      const { width, height } = (await doc.getPage(i + 1)).getViewport({ scale: 1 })
      return { width, height }
    }),
  )
  return { doc, sizes }
}
