// Pure helpers for the PDF link layer: what a Link annotation points at, and where it sits on the page.

import { idFromAzlegUrl } from '../statutes/ref'

/** The fields of a pdf.js annotation the link layer reads. */
export interface LinkAnnotationLike {
  subtype?: string
  rect?: number[]
  url?: string
  unsafeUrl?: string
  dest?: string | unknown[] | null
}

export type LinkTarget =
  | { kind: 'statute'; id: string; url: string }
  | { kind: 'dest'; dest: string | unknown[] }
  | { kind: 'url'; url: string }

/** What a link annotation does: open a statute, jump inside the PDF, or open another site. */
export function classifyLink(a: LinkAnnotationLike): LinkTarget | null {
  if (a.subtype !== 'Link') return null
  if (a.url) {
    const id = idFromAzlegUrl(a.url)
    return id ? { kind: 'statute', id, url: a.url } : { kind: 'url', url: a.url }
  }
  if (typeof a.dest === 'string' ? a.dest : Array.isArray(a.dest) && a.dest.length) {
    return { kind: 'dest', dest: a.dest as string | unknown[] }
  }
  return null
}

/** A link's box as percentages of the page, so it stays put at any zoom. */
export interface PercentBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Box for an annotation rect [x1, y1, x2, y2] in PDF user space. `toViewport` is
 * viewport.convertToViewportPoint (pdf.js 6 dropped convertToViewportRectangle); the y axis flips,
 * so the corners are normalized, then divided by the viewport size. Returns null for empty boxes.
 */
export function linkBox(
  rect: number[],
  toViewport: (x: number, y: number) => number[],
  viewport: { width: number; height: number },
): PercentBox | null {
  if (rect.length !== 4 || !viewport.width || !viewport.height) return null
  const [x1, y1] = toViewport(rect[0], rect[1])
  const [x2, y2] = toViewport(rect[2], rect[3])
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)
  if (!(width > 0 && height > 0)) return null
  return {
    left: (left / viewport.width) * 100,
    top: (top / viewport.height) * 100,
    width: (width / viewport.width) * 100,
    height: (height / viewport.height) * 100,
  }
}

/** A page reference from an explicit destination: pdf.js gives either a {num, gen} ref or a 0-based index. */
export function destPageRef(dest: unknown[]): { num: number; gen: number } | number | null {
  const first = dest[0]
  if (typeof first === 'number' && Number.isInteger(first)) return first
  if (first && typeof first === 'object' && 'num' in first && 'gen' in first) {
    return first as { num: number; gen: number }
  }
  return null
}
