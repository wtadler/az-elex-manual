import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getHashParam, setHashParam } from './hashQuery'
import { canGoBack, currentRef, popHistory, pushHistory, resetHistory } from './statutes/history'
import { normalizeStatuteRef } from './statutes/ref'
import { ARS_HASH_PARAM, StatutePanelContext, type StatutePanelApi } from './useStatutePanel'

interface State {
  isOpen: boolean
  stack: string[]
  nonce: number
}

function replaceHash(hash: string) {
  if (hash === window.location.hash) return
  // replaceState doesn't fire hashchange, so the route doesn't re-render and no history entry piles up.
  history.replaceState(history.state, '', hash)
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

  // State -> hash: keep ars=<ref> while open, drop it on close. Other params are preserved.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
    const hash = window.location.hash
    const ref = state.isOpen ? currentRef(state.stack) : null
    if (ref == null && getHashParam(hash, ARS_HASH_PARAM) == null) return
    replaceHash(setHashParam(hash, ARS_HASH_PARAM, ref))
  }, [state])

  // Hash -> state: a pasted link or Back to a different ref opens it. Navigating to a tab (whose
  // link has no ars param) keeps the panel open and re-adds the param.
  useEffect(() => {
    const onChange = () => {
      const hash = window.location.hash
      const ref = normalizeStatuteRef(getHashParam(hash, ARS_HASH_PARAM))
      const s = stateRef.current
      const shown = s.isOpen ? currentRef(s.stack) : null
      if (ref == null) {
        if (shown) replaceHash(setHashParam(hash, ARS_HASH_PARAM, shown))
        return
      }
      if (ref !== shown) openStatute(ref)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [openStatute])

  const current = currentRef(state.stack)
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
