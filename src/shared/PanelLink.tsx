import type { AnchorHTMLAttributes } from 'react'
import { openInPanelOnPlainClick } from './clicks'

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick' | 'target' | 'rel'> & {
  /** The real destination, used for cmd/ctrl/shift/alt/middle clicks and when there's no panel. */
  href: string
  /** Opens the in-app panel. Without it the link is an ordinary new-tab link. */
  onOpen?: () => void
}

/**
 * A link with a real href (opened in a new tab) that a plain click opens in an in-app panel
 * instead. Modifier and middle clicks keep browser behavior, so "open in new tab" still works.
 */
export function PanelLink({ href, onOpen, children, ...rest }: Props) {
  return (
    <a {...rest} href={href} target="_blank" rel="noreferrer" onClick={(e) => openInPanelOnPlainClick(e, onOpen)}>
      {children}
    </a>
  )
}
