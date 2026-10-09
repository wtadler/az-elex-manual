import { statuteUrl } from './citation'
import { PdfPageLink } from './PdfPageLink'
import { StatuteLink } from './StatuteLink'
import type { Citation } from './types'

/**
 * Renders a citation as links: "EPM p. 211 · A.R.S. § 16-584(B)". Use it for every rule.
 * The EPM link opens the in-app PDF panel and the statute link opens the in-app statute panel;
 * modifier clicks open the raw PDF or azleg.gov. Other refs (Const., U.S.C.) are plain text.
 */
export function Cite({ epmPage, statute }: Citation) {
  return (
    <span className="cite">
      {epmPage != null && (
        <PdfPageLink printedPage={epmPage}>EPM p.&nbsp;{epmPage}</PdfPageLink>
      )}
      {epmPage != null && statute && ' · '}
      {statute &&
        (statuteUrl(statute) ? <StatuteLink statute={statute}>A.R.S. §&nbsp;{statute}</StatuteLink> : statute)}
    </span>
  )
}
