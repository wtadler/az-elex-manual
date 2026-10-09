import { describe, expect, it } from 'vitest'
import { classifyLink, destPageRef, linkBox } from './pdfLinks'

describe('classifyLink', () => {
  it('sends azleg A.R.S. pages to the statute panel', () => {
    expect(classifyLink({ subtype: 'Link', url: 'https://www.azleg.gov/ars/16/00579.htm' })).toEqual({
      kind: 'statute',
      id: '16-579',
      url: 'https://www.azleg.gov/ars/16/00579.htm',
    })
    expect(
      classifyLink({ subtype: 'Link', url: 'https://www.azleg.gov/viewdocument/?docName=https://www.azleg.gov/ars/16/00103.htm' }),
    ).toMatchObject({ kind: 'statute', id: '16-103' })
  })

  it('keeps other URLs as plain links', () => {
    expect(classifyLink({ subtype: 'Link', url: 'https://azsos.gov/media/77' })).toEqual({ kind: 'url', url: 'https://azsos.gov/media/77' })
    expect(classifyLink({ subtype: 'Link', url: 'https://www.azleg.gov/arsDetail/?title=16' })).toMatchObject({ kind: 'url' })
  })

  it('recognizes internal destinations, named or explicit', () => {
    expect(classifyLink({ subtype: 'Link', dest: 'p14' })).toEqual({ kind: 'dest', dest: 'p14' })
    const explicit = [{ num: 12, gen: 0 }, { name: 'XYZ' }, 0, 792, null]
    expect(classifyLink({ subtype: 'Link', dest: explicit })).toEqual({ kind: 'dest', dest: explicit })
  })

  it('ignores non-links and links with nothing to follow', () => {
    expect(classifyLink({ subtype: 'Widget', url: 'https://example.com' })).toBeNull()
    expect(classifyLink({ subtype: 'Link' })).toBeNull()
    expect(classifyLink({ subtype: 'Link', dest: '' })).toBeNull()
    expect(classifyLink({ subtype: 'Link', dest: [] })).toBeNull()
    expect(classifyLink({ subtype: 'Link', dest: null })).toBeNull()
  })
})

describe('linkBox', () => {
  // What pdf.js's PageViewport does for an unrotated US Letter page: flip y, then scale.
  const letter = (scale: number) => ({
    width: 612 * scale,
    height: 792 * scale,
    toViewport: (x: number, y: number) => [x * scale, (792 - y) * scale],
  })

  it('converts a PDF rect to percentages of the page', () => {
    const v = letter(1)
    const box = linkBox([61.2, 712.8, 122.4, 792], v.toViewport, v)!
    expect(box.left).toBeCloseTo(10)
    expect(box.top).toBeCloseTo(0)
    expect(box.width).toBeCloseTo(10)
    expect(box.height).toBeCloseTo(10)
  })

  it('gives the same percentages at any scale', () => {
    const rect = [154.282, 587.035, 266.431, 603.295]
    const a = linkBox(rect, letter(1).toViewport, letter(1))!
    const b = linkBox(rect, letter(1.7).toViewport, letter(1.7))!
    for (const k of ['left', 'top', 'width', 'height'] as const) expect(b[k]).toBeCloseTo(a[k])
  })

  it('normalizes corners given in any order', () => {
    const v = letter(2)
    const a = linkBox([100, 100, 200, 150], v.toViewport, v)
    const b = linkBox([200, 150, 100, 100], v.toViewport, v)
    expect(b).toEqual(a)
    expect(a!.top).toBeCloseTo(((792 - 150) / 792) * 100)
  })

  it('returns null for empty or malformed rects and empty viewports', () => {
    const v = letter(1)
    expect(linkBox([10, 10, 10, 20], v.toViewport, v)).toBeNull()
    expect(linkBox([1, 2, 3], v.toViewport, v)).toBeNull()
    expect(linkBox([0, 0, 10, 10], v.toViewport, { width: 0, height: 0 })).toBeNull()
  })
})

describe('destPageRef', () => {
  it('reads a page ref object or a page index', () => {
    expect(destPageRef([{ num: 12, gen: 0 }, { name: 'XYZ' }])).toEqual({ num: 12, gen: 0 })
    expect(destPageRef([3, { name: 'Fit' }])).toBe(3)
    expect(destPageRef([])).toBeNull()
    expect(destPageRef(['p14'])).toBeNull()
    expect(destPageRef([1.5])).toBeNull()
  })
})
