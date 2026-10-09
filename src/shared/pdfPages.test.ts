import { describe, expect, it } from 'vitest'
import {
  clampPdfPage,
  EPM_LAST_PRINTED_PAGE,
  EPM_PDF_PAGE_COUNT,
  parseGoToPage,
  parsePdfParam,
  pdfToPrintedPage,
  printedPageLabel,
  printedToPdfPage,
} from './pdfPages'

describe('printedToPdfPage', () => {
  it.each([
    [1, 15],
    [211, 225],
    [304, 318],
    [465, 479],
  ])('maps printed %i to PDF %i', (printed, pdf) => {
    expect(printedToPdfPage(printed)).toBe(pdf)
  })

  it('maps printed page 0 into the front matter (PDF 14)', () => {
    expect(printedToPdfPage(0)).toBe(14)
  })

  it.each([-13, -14, -500])('clamps printed %i to PDF page 1', (printed) => {
    expect(printedToPdfPage(printed)).toBe(1)
  })

  it.each([466, 480, 100000])('clamps printed %i to the last PDF page', (printed) => {
    expect(printedToPdfPage(printed)).toBe(EPM_PDF_PAGE_COUNT)
  })

  it.each([Number.NaN, Infinity, -Infinity])('maps non-finite %s to PDF page 1', (printed) => {
    expect(printedToPdfPage(printed)).toBe(1)
  })

  it('rounds fractional pages', () => {
    expect(printedToPdfPage(210.6)).toBe(225)
  })

  it('clamps to a smaller page count when given one', () => {
    expect(printedToPdfPage(300, 100)).toBe(100)
  })
})

describe('pdfToPrintedPage', () => {
  it('maps PDF 225 to printed 211 and PDF 15 to printed 1', () => {
    expect(pdfToPrintedPage(225)).toBe(211)
    expect(pdfToPrintedPage(15)).toBe(1)
  })

  it.each([1, 7, 14])('returns null for front-matter PDF page %i', (pdf) => {
    expect(pdfToPrintedPage(pdf)).toBeNull()
  })

  it('round-trips every printed page', () => {
    for (let p = 1; p <= EPM_LAST_PRINTED_PAGE; p++) expect(pdfToPrintedPage(printedToPdfPage(p))).toBe(p)
  })
})

describe('clampPdfPage', () => {
  it.each([
    [0, 1],
    [-3, 1],
    [1, 1],
    [479, 479],
    [480, 479],
    [Number.NaN, 1],
  ])('%s -> %i', (input, out) => {
    expect(clampPdfPage(input)).toBe(out)
  })
})

describe('printedPageLabel', () => {
  it('labels numbered pages with the printed number', () => {
    expect(printedPageLabel(225)).toBe('EPM p. 211')
  })
  it('labels the front matter', () => {
    expect(printedPageLabel(3)).toBe('Front matter')
  })
})

describe('parseGoToPage', () => {
  it.each([
    ['211', 211],
    [' 211 ', 211],
    ['p. 211', 211],
    ['p211', 211],
    ['P 211', 211],
    ['page 211', 211],
    ['pg. 211', 211],
    ['EPM p. 304', 304],
    ['007', 7],
  ])('parses %j as printed page %i', (input, page) => {
    expect(parseGoToPage(input)).toBe(page)
  })

  it.each([
    ['0', 1],
    ['-5', 1],
    ['466', EPM_LAST_PRINTED_PAGE],
    ['99999', EPM_LAST_PRINTED_PAGE],
  ])('clamps %j to %i', (input, page) => {
    expect(parseGoToPage(input)).toBe(page)
  })

  it.each(['', '   ', 'abc', '12abc', '1.5', '2e3', 'p.', '211-212', '٣'])('rejects %j', (input) => {
    expect(parseGoToPage(input)).toBeNull()
  })

  it('clamps to a custom last page', () => {
    expect(parseGoToPage('50', 10)).toBe(10)
  })
})

describe('parsePdfParam', () => {
  it.each([
    ['304', 304],
    ['-3', -3],
    [' 12 ', 12],
  ])('reads %j as %i', (input, page) => {
    expect(parsePdfParam(input)).toBe(page)
  })

  it.each([null, '', 'abc', '3.5', '1e2', '12x'])('returns null for %j', (input) => {
    expect(parsePdfParam(input)).toBeNull()
  })
})
