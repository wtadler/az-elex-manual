import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { getHashParam } from './hashQuery'
import { parsePdfParam, pdfToPrintedPage, printedToPdfPage } from './pdfPages'
import { useHashParamSync } from './useHashParamSync'
import { PDF_HASH_PARAM, PdfPanelContext, type PdfPanelApi } from './usePdfPanel'

/** The pdf= hash value for a PDF page: its printed page number, or nothing for front matter. */
function pdfParamFor(pdfPage: number): string | null {
  const printed = pdfToPrintedPage(pdfPage)
  return printed == null ? null : String(printed)
}

/** Canonical pdf= value ("0211" -> "211"), or null when it isn't a page number. */
function canonicalPdfParam(raw: string | null): string | null {
  const printed = parsePdfParam(raw)
  return printed == null ? null : String(printed)
}

export function PdfPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => {
    const printed = parsePdfParam(getHashParam(window.location.hash, PDF_HASH_PARAM))
    return {
      isOpen: printed != null,
      target: { pdfPage: printed == null ? 1 : printedToPdfPage(printed), nonce: 0 },
      current: printed == null ? 1 : printedToPdfPage(printed),
    }
  })

  const goTo = useCallback((pdfPage: number) => {
    setState((s) => ({ isOpen: true, current: pdfPage, target: { pdfPage, nonce: s.target.nonce + 1 } }))
  }, [])

  const openAt = useCallback((printedPage: number) => goTo(printedToPdfPage(printedPage)), [goTo])
  const open = useCallback(
    () => setState((s) => ({ isOpen: true, current: s.current, target: { pdfPage: s.current, nonce: s.target.nonce + 1 } })),
    [],
  )
  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), [])
  const reportPage = useCallback(
    (pdfPage: number) => setState((s) => (s.current === pdfPage ? s : { ...s, current: pdfPage })),
    [],
  )

  // Keep pdf=<printed page> in the hash while open. A pasted link or Back to a different page opens
  // the panel there; navigating to a tab (whose link has no pdf param) keeps it open and re-adds it.
  // Out-of-range values clamp, so a different string can still mean the page already shown.
  const onExternalChange = useCallback((printed: string) => {
    const pdfPage = printedToPdfPage(Number(printed))
    setState((s) =>
      s.isOpen && s.current === pdfPage ? s : { isOpen: true, current: pdfPage, target: { pdfPage, nonce: s.target.nonce + 1 } },
    )
  }, [])
  useHashParamSync(
    PDF_HASH_PARAM,
    state.isOpen ? pdfParamFor(state.current) : null,
    onExternalChange,
    canonicalPdfParam,
  )

  const api = useMemo<PdfPanelApi>(
    () => ({ isOpen: state.isOpen, target: state.target, openAt, open, close, reportPage }),
    [state.isOpen, state.target, openAt, open, close, reportPage],
  )
  return <PdfPanelContext.Provider value={api}>{children}</PdfPanelContext.Provider>
}
