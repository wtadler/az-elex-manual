import { statuteUrl } from './citation'
import { PdfPageLink } from './PdfPageLink'
import type { Citation } from './types'

/**
 * Renders a citation as links: "EPM p. 211 · A.R.S. § 16-584(B)". Use it for every rule.
 * The EPM link opens the in-app PDF panel; statute links open azleg.gov in a new tab.
 */
export function Cite({ epmPage, statute }: Citation) {
  const statuteHref = statute ? statuteUrl(statute) : null
  return (
    <span className="cite">
      {epmPage != null && (
        <PdfPageLink printedPage={epmPage}>EPM p.&nbsp;{epmPage}</PdfPageLink>
      )}
      {epmPage != null && statute && ' · '}
      {statute &&
        (statuteHref ? (
          <a href={statuteHref} target="_blank" rel="noreferrer">
            A.R.S. §&nbsp;{statute}
          </a>
        ) : (
          statute
        ))}
    </span>
  )
}
