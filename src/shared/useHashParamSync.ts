import { useEffect, useRef } from 'react'
import { getHashParam, setHashParam } from './hashQuery'

/** Replaces location.hash without a history entry. A no-op when the hash wouldn't change. */
export function replaceHash(hash: string) {
  if (hash === window.location.hash) return
  // replaceState doesn't fire hashchange, so the route doesn't re-render and no history entry piles up.
  history.replaceState(history.state, '', hash)
}

/** Keeps the raw param as-is. Pass a parser that canonicalizes it, or returns null for junk. */
const identity = (raw: string | null) => raw

/**
 * Keeps one hash query param ("#/route?<param>=<value>") in sync with a panel's state.
 *
 * - State -> hash: while `value` is non-null the param holds it; when it turns null the param is
 *   dropped (and left alone if it's already absent). Other params are preserved.
 * - Hash -> state: on hashchange, the param is canonicalized with `parse`. If it's missing or
 *   unparseable while `value` is set (say, a tab link without the param), the param is put back.
 *   If it parses to something other than `value` (a pasted link, Back), `onExternalChange` gets it.
 *
 * Read the initial state from the hash yourself; this hook writes the canonical value on mount.
 */
export function useHashParamSync(
  param: string,
  value: string | null,
  onExternalChange: (parsed: string) => void,
  parse: (raw: string | null) => string | null = identity,
) {
  const latest = useRef({ value, onExternalChange, parse })
  useEffect(() => {
    latest.current = { value, onExternalChange, parse }
  })

  useEffect(() => {
    const hash = window.location.hash
    if (value == null && getHashParam(hash, param) == null) return
    replaceHash(setHashParam(hash, param, value))
  }, [param, value])

  useEffect(() => {
    const onChange = () => {
      const hash = window.location.hash
      const { value: shown, onExternalChange: notify, parse: canonical } = latest.current
      const parsed = canonical(getHashParam(hash, param))
      if (parsed == null) {
        if (shown != null) replaceHash(setHashParam(hash, param, shown))
        return
      }
      if (parsed !== shown) notify(parsed)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [param])
}
