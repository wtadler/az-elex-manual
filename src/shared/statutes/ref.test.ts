import { describe, expect, it } from 'vitest'
import { statuteUrl } from '../citation'
import { formatStatuteRef, idFromAzlegUrl, normalizeStatuteRef, parseStatuteRef, statuteLabel } from './ref'

describe('parseStatuteRef', () => {
  it.each([
    ['16-579(A)(1)(a)', '16-579', ['A', '1', 'a']],
    ['16-579(A)(1)', '16-579', ['A', '1']],
    ['A.R.S. § 16-121.01(B)', '16-121.01', ['B']],
    ['A.R.S. §16-121.01', '16-121.01', []],
    ['a.r.s. 16-584', '16-584', []],
    ['9-471', '9-471', []],
    ['1-243(A)', '1-243', ['A']],
    ['16-204.01', '16-204.01', []],
    ['16-168(G)(2)(a)', '16-168', ['G', '2', 'a']],
    ['16-168(G)(2)(a)(ii)', '16-168', ['G', '2', 'a', 'ii']],
    ['16-168(G)(2)(a)(i)', '16-168', ['G', '2', 'a', 'i']],
    ['16-804 (A)-(D)', '16-804', ['A']],
    ['  16-584(B) ', '16-584', ['B']],
  ])('%j -> %s %j', (ref, id, path) => {
    expect(parseStatuteRef(ref)).toEqual({ id, path })
  })

  it('stops at a label that does not nest deeper', () => {
    expect(parseStatuteRef('16-542(A)(B)')).toEqual({ id: '16-542', path: ['A'] })
    expect(parseStatuteRef('16-803(B)(C)')).toEqual({ id: '16-803', path: ['B'] })
    expect(parseStatuteRef('16-579(A)(1)(2)')).toEqual({ id: '16-579', path: ['A', '1'] })
  })

  it('treats (i) right under a number as the letter i', () => {
    expect(parseStatuteRef('16-1(A)(2)(i)')).toEqual({ id: '16-1', path: ['A', '2', 'i'] })
  })

  it.each([
    'Const. Art. IV, Pt. 1, § 1(3)',
    '52 U.S.C. § 21082(c)',
    'Procedures Manual',
    'MOVE Act',
    '',
    '2025-2026',
    'section 16',
  ])('%j is not an A.R.S. ref', (ref) => {
    expect(parseStatuteRef(ref)).toBeNull()
  })

  it('agrees with statuteUrl about what counts as an A.R.S. ref', () => {
    const refs = ['16-579(A)(1)', '16-121.01', '9-471', 'Const. Art. IV', '52 U.S.C. § 21082(c)', 'Procedures Manual']
    for (const r of refs) expect(parseStatuteRef(r) != null).toBe(statuteUrl(r) != null)
  })
})

describe('formatting refs', () => {
  it('round-trips the canonical form', () => {
    for (const r of ['16-579(A)(1)(a)', '16-121.01(B)', '9-471']) {
      expect(formatStatuteRef(parseStatuteRef(r)!)).toBe(r)
    }
  })

  it('normalizes prefixes and spacing', () => {
    expect(normalizeStatuteRef('A.R.S. § 16-579 (A)(1)')).toBe('16-579(A)(1)')
    expect(normalizeStatuteRef('Const. Art. IV')).toBeNull()
    expect(normalizeStatuteRef(null)).toBeNull()
  })

  it('labels refs for display', () => {
    expect(statuteLabel('16-579')).toBe('A.R.S. § 16-579')
    expect(statuteLabel({ id: '16-579', path: ['A'] })).toBe('A.R.S. § 16-579(A)')
  })
})

describe('idFromAzlegUrl', () => {
  it.each([
    ['https://www.azleg.gov/ars/16/00579.htm', '16-579'],
    ['https://www.azleg.gov/ars/16/00121-01.htm', '16-121.01'],
    ['https://www.azleg.gov/ars/9/00471.htm', '9-471'],
    ['http://www.azleg.gov/ars/16/00152.htm', '16-152'],
    ['https://azleg.gov/ars/16/00452.htm', '16-452'],
    ['HTTPS://WWW.AZLEG.GOV/ars/16/00579.htm', '16-579'],
    ['https://www.azleg.gov/ars/41/01001.htm', '41-1001'],
    ['https://www.azleg.gov/viewdocument/?docName=https://www.azleg.gov/ars/16/00103.htm', '16-103'],
    ['https://www.azleg.gov/viewdocument/?docName=http://www.azleg.gov/ars/16/00558.htm', '16-558'],
    ['https://www.azleg.gov/viewDocument/?docName=https%3A%2F%2Fwww.azleg.gov%2Fars%2F16%2F00121-01.htm', '16-121.01'],
  ])('%s -> %s', (url, id) => {
    expect(idFromAzlegUrl(url)).toBe(id)
  })

  it.each([
    'https://www.azleg.gov/arsDetail/?title=16',
    'https://www.azleg.gov/viewdocument/?docName=https://www.azleg.gov/legtext/56leg/1R/laws/0001.htm',
    'https://www.azleg.gov/viewdocument/',
    'https://www.law.cornell.edu/uscode/text/52/20505',
    'https://azsos.gov/media/77',
    'https://evil.example/ars/16/00579.htm',
    'https://www.azleg.gov.evil.example/ars/16/00579.htm',
    'not a url',
    '',
  ])('%s is not an A.R.S. page', (url) => {
    expect(idFromAzlegUrl(url)).toBeNull()
  })
})
