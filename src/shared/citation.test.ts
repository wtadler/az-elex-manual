import { describe, expect, it } from 'vitest'
import { EPM_PAGE_OFFSET, epmPdfUrl, statuteUrl } from './citation'

describe('statuteUrl', () => {
  it.each([
    ['16-579', 'https://www.azleg.gov/ars/16/00579.htm'],
    ['16-579(A)(1)(a)', 'https://www.azleg.gov/ars/16/00579.htm'],
    ['16-121.01', 'https://www.azleg.gov/ars/16/00121-01.htm'],
    ['16-204.01', 'https://www.azleg.gov/ars/16/00204-01.htm'],
    ['A.R.S. § 16-584(B)', 'https://www.azleg.gov/ars/16/00584.htm'],
    ['19-121', 'https://www.azleg.gov/ars/19/00121.htm'],
  ])('%s', (ref, url) => {
    expect(statuteUrl(ref)).toBe(url)
  })

  it.each(['Procedures Manual', 'MOVE Act', '52 U.S.C. § 21082(c)', ''])(
    'returns null for non-A.R.S. reference %j',
    (ref) => {
      expect(statuteUrl(ref)).toBeNull()
    },
  )
})

describe('epmPdfUrl', () => {
  it('maps printed page 1 to PDF page 15', () => {
    expect(EPM_PAGE_OFFSET).toBe(14)
    expect(epmPdfUrl(1)).toMatch(/epm\.pdf#page=15$/)
  })

  it('maps printed page 211 (provisional ballots) to PDF page 225', () => {
    expect(epmPdfUrl(211)).toMatch(/#page=225$/)
  })
})
