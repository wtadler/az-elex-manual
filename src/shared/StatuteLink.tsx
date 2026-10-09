import type { ReactNode } from 'react'
import { statuteUrl } from './citation'
import { isPlainClick } from './clicks'
import { useStatutePanel } from './useStatutePanel'

/**
 * Link to an Arizona statute. A plain click opens the in-app statute panel at the ref; cmd/ctrl/
 * shift/middle click still opens azleg.gov, because the href is the real azleg.gov page.
 * Refs statuteUrl() doesn't recognize render as plain text.
 */
export function StatuteLink({ statute, children }: { statute: string; children: ReactNode }) {
  const panel = useStatutePanel()
  const href = statuteUrl(statute)
  if (!href) return <>{children}</>
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        if (!panel || !isPlainClick(e)) return
        e.preventDefault()
        panel.openStatute(statute)
      }}
    >
      {children}
    </a>
  )
}
