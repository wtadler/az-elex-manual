// Arizona statute references: parsing "16-579(A)(1)(a)" and mapping azleg.gov links back to sections.

import { statuteUrl } from '../citation'
import { segmentLevel } from './paragraphs'

export interface StatuteRef {
  /** Section id as used in public/statutes: "16-579", "16-121.01", "9-471". */
  id: string
  /** Subsection labels, outermost first: ["A", "1", "a"]. Empty for the whole section. */
  path: string[]
}

/**
 * Parses an A.R.S. reference ("16-579(A)(1)(a)", "A.R.S. § 16-121.01(B)", "9-471"), or returns null
 * for anything that isn't one (Const., U.S.C., "Procedures Manual"). Accepts exactly what
 * statuteUrl() accepts. Subsection labels are kept while each one nests deeper than the last, so
 * "16-542(A)(B)" is just (A).
 */
export function parseStatuteRef(ref: string): StatuteRef | null {
  const trimmed = ref.trim()
  if (!statuteUrl(trimmed)) return null
  const rest = trimmed.replace(/^A\.R\.S\.\s*§*\s*/i, '')
  const m = rest.match(/^(\d{1,2})-(\d{1,4})(?:\.(\d{1,2}))?/)
  if (!m) return null
  const [whole, title, section, sub] = m
  const id = `${Number(title)}-${Number(section)}${sub ? `.${sub.padStart(2, '0')}` : ''}`

  const path: string[] = []
  let level = 0
  let tail = rest.slice(whole.length)
  for (;;) {
    const seg = tail.match(/^\s*\(([A-Za-z]{1,4}|\d{1,3})\)/)
    if (!seg) break
    const next = segmentLevel(seg[1], level)
    if (next <= level) break
    path.push(seg[1])
    level = next
    tail = tail.slice(seg[0].length)
  }
  return { id, path }
}

/** Canonical string for a ref: "16-579(A)(1)(a)". This is what the ars= hash param holds. */
export function formatStatuteRef({ id, path }: StatuteRef): string {
  return id + path.map((p) => `(${p})`).join('')
}

/** Canonical form of an A.R.S. reference ("A.R.S. § 16-579 (A)(1)" -> "16-579(A)(1)"), or null. */
export function normalizeStatuteRef(ref: string | null): string | null {
  const parsed = ref == null ? null : parseStatuteRef(ref)
  return parsed ? formatStatuteRef(parsed) : null
}

/** Display form: "A.R.S. § 16-579(A)(1)". */
export function statuteLabel(ref: StatuteRef | string): string {
  return `A.R.S. § ${typeof ref === 'string' ? ref : formatStatuteRef(ref)}`
}

/** azleg.gov page for a section id. */
export function azlegUrl(id: string): string {
  return statuteUrl(id) ?? 'https://www.azleg.gov/arstitle/'
}

const ARS_PAGE = /^https?:\/\/(?:www\.)?azleg\.gov\/ars\/(\d{1,2})\/(\d{1,5})(?:-(\d{1,2}))?\.htm$/i

/**
 * Section id for an azleg.gov statute page URL, or null if it isn't one. Handles
 * /ars/16/00579.htm, /ars/16/00121-01.htm, http or https, and the
 * /viewdocument/?docName=<ars page> wrapper. Title pages (/arsDetail/) and other sites are null.
 */
export function idFromAzlegUrl(url: string): string | null {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return null
  }
  if (!/^(www\.)?azleg\.gov$/i.test(u.hostname)) return null
  if (/^\/viewdocument\/?$/i.test(u.pathname)) {
    const inner = u.searchParams.get('docName')
    return inner && inner !== url ? idFromAzlegUrl(inner) : null
  }
  const m = `${u.protocol}//${u.hostname}${u.pathname}`.match(ARS_PAGE)
  if (!m) return null
  const [, title, section, sub] = m
  return `${Number(title)}-${Number(section)}${sub ? `.${sub.padStart(2, '0')}` : ''}`
}
