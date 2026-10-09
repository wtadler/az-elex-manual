import { createContext, useContext } from 'react'

/** Hash query param holding the open panel's printed page: "#/calendar?pdf=304". */
export const PDF_HASH_PARAM = 'pdf'

export interface PdfPanelApi {
  isOpen: boolean
  /** PDF page the viewer should scroll to. `nonce` changes on every request, even for the same page. */
  target: { pdfPage: number; nonce: number }
  /** Opens (or moves) the panel to a printed EPM page, the number in the page footer. */
  openAt: (printedPage: number) => void
  /** Opens the panel where it was last left, or at the cover. */
  open: () => void
  close: () => void
  /** Called by the viewer as the user scrolls, so the hash stays shareable. */
  reportPage: (pdfPage: number) => void
}

export const PdfPanelContext = createContext<PdfPanelApi | null>(null)

/** The panel API, or null outside a provider (links then fall back to opening the raw PDF). */
export function usePdfPanel(): PdfPanelApi | null {
  return useContext(PdfPanelContext)
}
