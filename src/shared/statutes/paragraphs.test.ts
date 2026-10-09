import { describe, expect, it } from 'vitest'
import { findSubsection, paragraphLabel, paragraphLevels, segmentLevel } from './paragraphs'

describe('paragraphLabel', () => {
  it.each([
    ['A. Every qualified elector shall…', 'A'],
    ['1. The elector shall present…', '1'],
    ['12. Something.', '12'],
    ['(a) A valid photo ID.', 'a'],
    ['(ii) A utility bill.', 'ii'],
    ['  B. Leading space.', 'B'],
    ['A person who knowingly…', null],
    ['In this section, unless the context otherwise requires:', null],
    ['2025. Not a label', null],
    ['(A) uppercase in parens is not a label we use', null],
    ['A.R.S. something', null],
  ])('%j -> %j', (text, label) => {
    expect(paragraphLabel(text)).toBe(label)
  })
})

describe('segmentLevel', () => {
  it.each([
    ['A', 0, 1],
    ['1', 1, 2],
    ['a', 2, 3],
    ['i', 2, 3],
    ['i', 3, 4],
    ['iv', 3, 4],
    ['x', 4, 4],
    ['b', 4, 3],
    ['?', 0, 0],
  ])('%s after level %i is level %i', (label, prev, level) => {
    expect(segmentLevel(label, prev)).toBe(level)
  })
})

const levels = (ps: string[]) => paragraphLevels(ps).map((p) => p.level)

describe('paragraphLevels', () => {
  it('nests A., 1., (a), (i)', () => {
    expect(levels(['A. a', '1. b', '(a) c', '(i) d', '(ii) e', '(b) f', '2. g', 'B. h'])).toEqual([1, 2, 3, 4, 4, 3, 2, 1])
  })

  it('treats (i) after (h) as a letter', () => {
    const ps = ['A. x', '1. x', ...'abcdefgh'.split('').map((c) => `(${c}) x`), '(i) x', '(j) x']
    expect(levels(ps)).toEqual([1, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3])
  })

  it('treats (v) and (x) as letters when they continue the list', () => {
    const letters = 'abcdefghijklmnopqrstuvwxy'.split('').map((c) => `(${c}) x`)
    expect(levels(['1. x', ...letters]).every((l, i) => (i === 0 ? l === 2 : l === 3))).toBe(true)
  })

  it('treats (v) under (a) as roman', () => {
    expect(levels(['(a) x', '(i) x', '(ii) x', '(iii) x', '(iv) x', '(v) x', '(b) x'])).toEqual([3, 4, 4, 4, 4, 4, 3])
  })

  it('treats a first (i) under a number as a letter', () => {
    expect(levels(['1. x', '(i) x'])).toEqual([2, 3])
  })

  it('resets the letter list after a number', () => {
    expect(levels(['(a) x', '(h) x', '1. x', '(a) x', '(i) x'])).toEqual([3, 3, 2, 3, 4])
  })

  it('gives unlabeled paragraphs level 0', () => {
    expect(paragraphLevels(['Intro text.', 'A. x'])).toEqual([
      { label: null, level: 0 },
      { label: 'A', level: 1 },
    ])
  })
})

describe('findSubsection', () => {
  const ps = [
    'A. Every qualified elector…',
    '1. The elector shall present any of the following:',
    '(a) One form of identification…',
    '(b) Two different items…',
    '2. If the elector does not present…',
    '(a) Provisional ballot…',
    'B. The county recorder shall…',
    '1. First thing under B.',
    '(a) Under B 1.',
    '(i) Roman under B 1 (a).',
    '3. Third under B.',
    'C. Last.',
  ]
  const infos = paragraphLevels(ps)

  it('finds the deepest match', () => {
    expect(findSubsection(infos, ['A', '1', 'a'])).toBe(2)
    expect(findSubsection(infos, ['A', '1', 'b'])).toBe(3)
    expect(findSubsection(infos, ['A', '2', 'a'])).toBe(5)
    expect(findSubsection(infos, ['B', '1', 'a', 'i'])).toBe(9)
    expect(findSubsection(infos, ['C'])).toBe(11)
  })

  it('takes repeated labels from the right subsection', () => {
    expect(findSubsection(infos, ['B', '1'])).toBe(7)
    expect(findSubsection(infos, ['B', '1', 'a'])).toBe(8)
  })

  it('stops at the parent when a child is missing (partial match)', () => {
    expect(findSubsection(infos, ['A', '1', 'z'])).toBe(1)
    expect(findSubsection(infos, ['A', '9'])).toBe(0)
  })

  it('does not take a child from a later subsection', () => {
    // A has no 3., but B does.
    expect(findSubsection(infos, ['A', '3'])).toBe(0)
  })

  it('returns null when nothing matches or the path is empty', () => {
    expect(findSubsection(infos, ['Z'])).toBeNull()
    expect(findSubsection(infos, ['Z', '1'])).toBeNull()
    expect(findSubsection(infos, [])).toBeNull()
    expect(findSubsection([], ['A'])).toBeNull()
  })

  it('matches a path that starts at a number when a section has no lettered subsections', () => {
    const flat = paragraphLevels(['Intro:', '1. one', '2. two', '(a) two a'])
    expect(findSubsection(flat, ['2', 'a'])).toBe(3)
  })
})
