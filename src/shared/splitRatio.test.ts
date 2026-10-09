import { describe, expect, it } from 'vitest'
import {
  clampSplit,
  DEFAULT_SPLIT,
  loadSplit,
  MAX_SPLIT,
  MIN_SPLIT,
  saveSplit,
  SPLIT_STORAGE_KEY,
  splitFromPointer,
} from './splitRatio'

describe('clampSplit', () => {
  it.each([
    [0.5, 0.5],
    [0, MIN_SPLIT],
    [1, MAX_SPLIT],
    [Number.NaN, DEFAULT_SPLIT],
    [Number.POSITIVE_INFINITY, DEFAULT_SPLIT],
  ])('%s -> %s', (r, out) => {
    expect(clampSplit(r)).toBe(out)
  })
})

describe('splitFromPointer', () => {
  it('is the pointer position as a share of the column', () => {
    expect(splitFromPointer(300, 100, 400)).toBe(0.5)
    expect(splitFromPointer(0, 100, 400)).toBe(MIN_SPLIT)
    expect(splitFromPointer(10_000, 100, 400)).toBe(MAX_SPLIT)
    expect(splitFromPointer(300, 100, 0)).toBe(DEFAULT_SPLIT)
  })
})

describe('loadSplit / saveSplit', () => {
  function memory() {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
  }

  it('round-trips through storage', () => {
    const s = memory()
    saveSplit(0.3, s)
    expect(s.m.get(SPLIT_STORAGE_KEY)).toBe('0.300')
    expect(loadSplit(s)).toBe(0.3)
  })

  it('defaults when nothing or garbage is stored', () => {
    const s = memory()
    expect(loadSplit(s)).toBe(DEFAULT_SPLIT)
    s.setItem(SPLIT_STORAGE_KEY, 'wide')
    expect(loadSplit(s)).toBe(DEFAULT_SPLIT)
    s.setItem(SPLIT_STORAGE_KEY, '5')
    expect(loadSplit(s)).toBe(MAX_SPLIT)
  })

  it('survives storage that throws or is missing', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadSplit(throwing)).toBe(DEFAULT_SPLIT)
    expect(() => saveSplit(0.4, throwing)).not.toThrow()
    expect(loadSplit(undefined)).toBe(DEFAULT_SPLIT)
  })
})
