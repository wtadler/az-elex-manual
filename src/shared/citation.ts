// Printed page 1 of the EPM is PDF page 15.
export const EPM_PAGE_OFFSET = 14

export const PDF_URL = `${import.meta.env.BASE_URL}epm.pdf`

/** Link that opens the bundled PDF at a printed EPM page. */
export function epmPdfUrl(printedPage: number): string {
  return `${PDF_URL}#page=${printedPage + EPM_PAGE_OFFSET}`
}

/**
 * azleg.gov URL for an Arizona statute reference, or null if it isn't one.
 * "16-579(A)(1)" -> https://www.azleg.gov/ars/16/00579.htm
 * "16-121.01"    -> https://www.azleg.gov/ars/16/00121-01.htm
 */
export function statuteUrl(ref: string): string | null {
  const m = ref
    .replace(/^A\.R\.S\.\s*§*\s*/i, '')
    .match(/^(\d{1,2})-(\d{1,4})(?:\.(\d{1,2}))?/)
  if (!m) return null
  const [, title, section, sub] = m
  const file = section.padStart(5, '0') + (sub ? `-${sub.padStart(2, '0')}` : '')
  return `https://www.azleg.gov/ars/${title}/${file}.htm`
}
