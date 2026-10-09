// Finds section numbers in statute text ("section 16-584", "sections 16-542 and 16-543") so they can be links.

export type TextPart = { text: string; id?: undefined } | { text: string; id: string }

/**
 * A section number: 1–2 digit title, hyphen, 3–4 digit section, optional ".01". The lookarounds
 * skip years ("2025-2026"), phone numbers ("602-542-4285"), dates, and pieces of longer numbers.
 */
const SECTION = /(?<![\w.\-–])(\d{1,2})-(\d{3,4})(?:\.(\d{1,2}))?(?![\w\-–]|\.\d)/g

/** Splits text into plain parts and section-number parts (which carry their section id). */
export function linkifySections(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(SECTION)) {
    const [whole, title, section, sub] = m
    const at = m.index
    if (at > last) parts.push({ text: text.slice(last, at) })
    parts.push({ text: whole, id: `${Number(title)}-${Number(section)}${sub ? `.${sub.padStart(2, '0')}` : ''}` })
    last = at + whole.length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}
