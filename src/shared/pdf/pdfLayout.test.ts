import { describe, expect, it } from 'vitest'
import { clampScale, computeLayout, fitWidthScale, PAGE_GAP, PAGE_PADDING, pageAtOffset } from './pdfLayout'

const letter = { width: 612, height: 792 }

describe('computeLayout', () => {
  it('stacks pages with padding and gaps', () => {
    const l = computeLayout([letter, letter, letter], 1)
    expect(l.tops).toEqual([PAGE_PADDING, PAGE_PADDING + 792 + PAGE_GAP, PAGE_PADDING + 2 * (792 + PAGE_GAP)])
    expect(l.total).toBe(PAGE_PADDING * 2 + 3 * 792 + 2 * PAGE_GAP)
  })

  it('scales and floors page sizes', () => {
    const l = computeLayout([letter], 0.5)
    expect(l.widths).toEqual([306])
    expect(l.heights).toEqual([396])
  })

  it('handles mixed page sizes', () => {
    const l = computeLayout([letter, { width: 792, height: 612 }], 1)
    expect(l.heights).toEqual([792, 612])
    expect(l.tops[1]).toBe(PAGE_PADDING + 792 + PAGE_GAP)
  })

  it('is empty for no pages', () => {
    expect(computeLayout([], 1)).toEqual({ tops: [], widths: [], heights: [], total: 0 })
  })
})

describe('pageAtOffset', () => {
  const l = computeLayout([letter, letter, letter], 1)
  it.each([
    [-100, 1],
    [0, 1],
    [PAGE_PADDING + 791, 1],
    [PAGE_PADDING + 792 + PAGE_GAP, 2],
    [l.tops[2] + 10, 3],
    [1e9, 3],
  ])('offset %i is on page %i', (y, page) => {
    expect(pageAtOffset(l, y)).toBe(page)
  })

  it('returns 1 for an empty layout', () => {
    expect(pageAtOffset(computeLayout([], 1), 50)).toBe(1)
  })
})

describe('fitWidthScale', () => {
  it('fits the widest page inside the padding', () => {
    expect(fitWidthScale(612 + PAGE_PADDING * 2, [letter])).toBe(1)
    expect(fitWidthScale(306 + PAGE_PADDING * 2, [letter, { width: 400, height: 10 }])).toBeCloseTo(306 / 612)
  })

  it('falls back to 1 with no width or pages, and never goes below 0.1', () => {
    expect(fitWidthScale(0, [letter])).toBe(1)
    expect(fitWidthScale(500, [])).toBe(1)
    expect(fitWidthScale(25, [letter])).toBe(0.1)
  })
})

describe('clampScale', () => {
  it.each([
    [0.01, 0.25],
    [1, 1],
    [10, 4],
  ])('%s -> %s', (s, out) => {
    expect(clampScale(s)).toBe(out)
  })
})
