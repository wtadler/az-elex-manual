import { createContext, useContext } from 'react'

/** Hash query param holding the open statute: "#/calendar?ars=16-579(A)(1)". */
export const ARS_HASH_PARAM = 'ars'

export interface StatutePanelApi {
  isOpen: boolean
  /** Canonical ref being shown, e.g. "16-579(A)(1)", or null when nothing has been opened. */
  current: string | null
  /** Changes on every open, even of the same ref, so the viewer scrolls to the subsection again. */
  nonce: number
  canGoBack: boolean
  /** Opens the panel at an A.R.S. ref, starting a fresh back history. Ignores non-A.R.S. refs. */
  openStatute: (ref: string) => void
  /** Follows a link inside the panel, so Back returns here. */
  navigate: (ref: string) => void
  back: () => void
  close: () => void
}

export const StatutePanelContext = createContext<StatutePanelApi | null>(null)

/** The statute panel API, or null outside a provider (statute links then open azleg.gov). */
export function useStatutePanel(): StatutePanelApi | null {
  return useContext(StatutePanelContext)
}
