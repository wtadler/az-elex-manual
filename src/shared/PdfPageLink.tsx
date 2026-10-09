import type { ReactNode } from 'react'
import { epmPdfUrl } from './citation'
import { PanelLink } from './PanelLink'
import { usePdfPanel } from './usePdfPanel'

/**
 * Link to a printed EPM page. A plain click opens the in-app PDF panel there; cmd/ctrl/shift/middle
 * click still opens the raw PDF in a new tab or window, because the href is the real PDF URL.
 */
export function PdfPageLink({ printedPage, children }: { printedPage: number; children: ReactNode }) {
  const panel = usePdfPanel()
  return (
    <PanelLink href={epmPdfUrl(printedPage)} onOpen={panel ? () => panel.openAt(printedPage) : undefined}>
      {children}
    </PanelLink>
  )
}
