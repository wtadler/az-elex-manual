import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { getHashParam } from './hashQuery'
import { canGoBack, currentRef, popHistory, pushHistory, resetHistory } from './statutes/history'
import { normalizeStatuteRef } from './statutes/ref'
import { useHashParamSync } from './useHashParamSync'
import { ARS_HASH_PARAM, StatutePanelContext, type StatutePanelApi } from './useStatutePanel'

interface State {
  isOpen: boolean
  stack: string[]
  nonce: number
}

export function StatutePanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => {
    const ref = normalizeStatuteRef(getHashParam(window.location.hash, ARS_HASH_PARAM))
    return { isOpen: ref != null, stack: ref ? resetHistory(ref) : [], nonce: 0 }
  })

  const openStatute = useCallback((raw: string) => {
    const ref = normalizeStatuteRef(raw)
    if (ref) setState((s) => ({ isOpen: true, stack: resetHistory(ref), nonce: s.nonce + 1 }))
  }, [])
  const navigate = useCallback((raw: string) => {
    const ref = normalizeStatuteRef(raw)
    if (ref) setState((s) => ({ isOpen: true, stack: pushHistory(s.stack, ref), nonce: s.nonce + 1 }))
  }, [])
  const back = useCallback(() => setState((s) => ({ ...s, stack: popHistory(s.stack), nonce: s.nonce + 1 })), [])
  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), [])

  // Keep ars=<ref> in the hash while open. A pasted link or Back to a different ref opens it;
  // navigating to a tab (whose link has no ars param) keeps the panel open and re-adds the param.
  const current = currentRef(state.stack)
  useHashParamSync(ARS_HASH_PARAM, state.isOpen ? current : null, openStatute, normalizeStatuteRef)

  const api = useMemo<StatutePanelApi>(
    () => ({
      isOpen: state.isOpen && current != null,
      current,
      nonce: state.nonce,
      canGoBack: canGoBack(state.stack),
      openStatute,
      navigate,
      back,
      close,
    }),
    [state.isOpen, state.nonce, state.stack, current, openStatute, navigate, back, close],
  )
  return <StatutePanelContext.Provider value={api}>{children}</StatutePanelContext.Provider>
}
