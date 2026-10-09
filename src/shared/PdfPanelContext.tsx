import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EPM_PAGE_OFFSET } from './citation'
import { getHashParam, setHashParam } from './hashQuery'
import { parsePdfParam, printedToPdfPage } from './pdfPages'
import { PDF_HASH_PARAM, PdfPanelContext, type PdfPanelApi } from './usePdfPanel'

function replaceHash(hash: string) {
  if (hash === window.location.hash) return
  // replaceState doesn't fire hashchange, so the route doesn't re-render and no history entry piles up.
  history.replaceState(history.state, '', hash)
}

function printedFor(pdfPage: number): string {
  return String(pdfPage - EPM_PAGE_OFFSET)
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

  // State -> hash: keep pdf=<printed page> while open, drop it on close. Other params are preserved.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
    const hash = window.location.hash
    if (!state.isOpen && getHashParam(hash, PDF_HASH_PARAM) == null) return
    replaceHash(setHashParam(hash, PDF_HASH_PARAM, state.isOpen ? printedFor(state.current) : null))
  }, [state])

  // Hash -> state: a pasted link or Back to a different page opens the panel there. Navigating to a
  // tab (whose link has no pdf param) keeps the panel open and re-adds the param.
  useEffect(() => {
    const onChange = () => {
      const hash = window.location.hash
      const printed = parsePdfParam(getHashParam(hash, PDF_HASH_PARAM))
      const s = stateRef.current
      if (printed == null) {
        if (s.isOpen) replaceHash(setHashParam(hash, PDF_HASH_PARAM, printedFor(s.current)))
        return
      }
      const pdfPage = printedToPdfPage(printed)
      if (!s.isOpen || pdfPage !== s.current) goTo(pdfPage)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [goTo])

  const api = useMemo<PdfPanelApi>(
    () => ({ isOpen: state.isOpen, target: state.target, openAt, open, close, reportPage }),
    [state.isOpen, state.target, openAt, open, close, reportPage],
  )
  return <PdfPanelContext.Provider value={api}>{children}</PdfPanelContext.Provider>
}
