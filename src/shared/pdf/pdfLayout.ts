// Pure layout math for the PDF panel: where each page sits in the scroll container at a given scale.

export interface PageSize {
  width: number
  height: number
}

export interface PdfLayout {
  /** Top offset of each page (index 0 is PDF page 1), in CSS pixels from the scroll container top. */
  tops: number[]
  widths: number[]
  heights: number[]
  /** Total scrollable height, including padding. */
  total: number
}

export const PAGE_GAP = 12
export const PAGE_PADDING = 12

/** Lays out pages top to bottom at `scale`. Sizes are page viewports at scale 1. */
export function computeLayout(sizes: PageSize[], scale: number): PdfLayout {
  const tops: number[] = []
  const widths: number[] = []
  const heights: number[] = []
  let y = PAGE_PADDING
  for (const s of sizes) {
    const w = Math.floor(s.width * scale)
    const h = Math.floor(s.height * scale)
    tops.push(y)
    widths.push(w)
    heights.push(h)
    y += h + PAGE_GAP
  }
  const total = sizes.length ? y - PAGE_GAP + PAGE_PADDING : 0
  return { tops, widths, heights, total }
}

/** Scale at which the widest page fills the container width, less padding. Never below 0.1. */
export function fitWidthScale(containerWidth: number, sizes: PageSize[]): number {
  const widest = sizes.reduce((m, s) => Math.max(m, s.width), 0)
  if (!widest || containerWidth <= 0) return 1
  return Math.max(0.1, (containerWidth - PAGE_PADDING * 2) / widest)
}

/** 1-based PDF page whose box (plus the gap below it) contains offset `y`. */
export function pageAtOffset(layout: PdfLayout, y: number): number {
  const { tops } = layout
  if (!tops.length) return 1
  let lo = 0
  let hi = tops.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (tops[mid] <= y) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

/** Clamps a zoom scale to a sane range. */
export function clampScale(scale: number): number {
  return Math.min(4, Math.max(0.25, scale))
}
