import { EPM_PAGE_OFFSET } from './citation'

/** Number of pages in public/epm.pdf. The viewer uses the loaded document's count when it has it. */
export const EPM_PDF_PAGE_COUNT = 479

/** Last printed page number (the footer of the final PDF page). */
export const EPM_LAST_PRINTED_PAGE = EPM_PDF_PAGE_COUNT - EPM_PAGE_OFFSET

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Clamps any number to a valid 1-based PDF page. Non-finite input becomes page 1. */
export function clampPdfPage(pdfPage: number, pageCount = EPM_PDF_PAGE_COUNT): number {
  if (!Number.isFinite(pdfPage)) return 1
  return clamp(Math.round(pdfPage), 1, Math.max(1, pageCount))
}

/** Printed (footer) page number -> PDF page, clamped to the document. */
export function printedToPdfPage(printedPage: number, pageCount = EPM_PDF_PAGE_COUNT): number {
  if (!Number.isFinite(printedPage)) return 1
  return clampPdfPage(Math.round(printedPage) + EPM_PAGE_OFFSET, pageCount)
}

/** PDF page -> printed page number, or null for the unnumbered front matter (PDF pages 1–14). */
export function pdfToPrintedPage(pdfPage: number): number | null {
  const printed = Math.round(pdfPage) - EPM_PAGE_OFFSET
  return printed >= 1 ? printed : null
}

/** Short label for the page indicator: "EPM p. 211", or "Front matter" before printed page 1. */
export function printedPageLabel(pdfPage: number): string {
  const printed = pdfToPrintedPage(pdfPage)
  return printed == null ? 'Front matter' : `EPM p. ${printed}`
}

/**
 * Parses the go-to-page box, which takes a printed page number ("211", "p. 211", "EPM p 211").
 * Returns the printed page clamped to 1..last printed page, or null if there's no number to use.
 */
export function parseGoToPage(input: string, lastPrinted = EPM_LAST_PRINTED_PAGE): number | null {
  const m = input.trim().match(/^(?:epm\s*)?(?:p(?:age|g)?\.?\s*)?(-?\d+)$/i)
  if (!m) return null
  const n = Number.parseInt(m[1], 10)
  if (!Number.isFinite(n)) return null
  return clamp(n, 1, Math.max(1, lastPrinted))
}

/** Reads the `pdf=<printedPage>` hash param. Returns the printed page, or null if absent or malformed. */
export function parsePdfParam(value: string | null): number | null {
  if (value == null || !/^-?\d+$/.test(value.trim())) return null
  return Number.parseInt(value, 10)
}
