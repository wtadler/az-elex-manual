import { describe, expect, it } from 'vitest'
import { linkifySections } from './crossRefs'

const ids = (text: string) => linkifySections(text).flatMap((p) => (p.id ? [p.id] : []))

describe('linkifySections', () => {
  it('links "section 16-584"', () => {
    expect(linkifySections('as prescribed by section 16-584.')).toEqual([
      { text: 'as prescribed by section ' },
      { text: '16-584', id: '16-584' },
      { text: '.' },
    ])
  })

  it('links every section in a list', () => {
    expect(ids('pursuant to sections 16-542 and 16-543')).toEqual(['16-542', '16-543'])
    expect(ids('sections 16-542, 16-543 and 16-544, subsection A')).toEqual(['16-542', '16-543', '16-544'])
    expect(ids('sections 16-542, 16-543, and 16-544.')).toEqual(['16-542', '16-543', '16-544'])
  })

  it('links dotted sections and other titles', () => {
    expect(ids('under section 16-121.01, subsection B')).toEqual(['16-121.01'])
    expect(ids('see 16-121.01.')).toEqual(['16-121.01'])
    expect(ids('title 9, section 9-471')).toEqual(['9-471'])
    expect(ids('section 41-1001')).toEqual(['41-1001'])
    expect(ids('(section 16-579)')).toEqual(['16-579'])
  })

  it('keeps the original text intact', () => {
    const text = 'A. Under sections 16-542 and 16-121.01, the recorder (602-542-4285) acts in 2025-2026.'
    expect(linkifySections(text).map((p) => p.text).join('')).toBe(text)
  })

  it.each([
    'for the 2025-2026 election cycle',
    'call 602-542-4285',
    'call (602) 542-4285',
    'call 1-800-352-8404',
    'on 10-15-2026',
    'between 3-5 days',
    'Laws 1998, ch. 12-34',
    'item 16-579A',
    'version 1.16-579',
    'range 16-579-580',
  ])('no false positive in %j', (text) => {
    expect(ids(text)).toEqual([])
  })

  it('returns one plain part for text without sections, and nothing for empty text', () => {
    expect(linkifySections('No references here.')).toEqual([{ text: 'No references here.' }])
    expect(linkifySections('')).toEqual([])
  })
})
