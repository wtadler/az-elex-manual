import { epmPdfUrl, statuteUrl } from './citation'
import type { Citation } from './types'

/** Renders a citation as links: "EPM p. 211 · A.R.S. § 16-584(B)". Use it for every rule. */
export function Cite({ epmPage, statute }: Citation) {
  const statuteHref = statute ? statuteUrl(statute) : null
  return (
    <span className="cite">
      {epmPage != null && (
        <a href={epmPdfUrl(epmPage)} target="_blank" rel="noreferrer">
          EPM p.&nbsp;{epmPage}
        </a>
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
