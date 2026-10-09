import { describe, expect, it } from 'vitest'
import { formatRetrieved } from './format'
import { canGoBack, currentRef, MAX_HISTORY, popHistory, pushHistory, resetHistory } from './history'

describe('statute history', () => {
  it('starts with one entry and cannot go back', () => {
    const s = resetHistory('16-579(A)')
    expect(s).toEqual(['16-579(A)'])
    expect(canGoBack(s)).toBe(false)
    expect(currentRef(s)).toBe('16-579(A)')
  })

  it('pushes and pops', () => {
    let s = resetHistory('16-579(A)')
    s = pushHistory(s, '16-584')
    s = pushHistory(s, '16-121.01')
    expect(currentRef(s)).toBe('16-121.01')
    expect(canGoBack(s)).toBe(true)
    s = popHistory(s)
    expect(currentRef(s)).toBe('16-584')
    s = popHistory(s)
    expect(currentRef(s)).toBe('16-579(A)')
    expect(popHistory(s)).toBe(s)
  })

  it('does not stack the same ref twice in a row', () => {
    const s = pushHistory(['16-579'], '16-579')
    expect(s).toEqual(['16-579'])
  })

  it('reset drops the old stack', () => {
    expect(resetHistory('9-471')).toEqual(['9-471'])
  })

  it('caps its length, keeping the newest entries', () => {
    let s = resetHistory('0')
    for (let i = 1; i <= MAX_HISTORY + 5; i++) s = pushHistory(s, String(i))
    expect(s).toHaveLength(MAX_HISTORY)
    expect(currentRef(s)).toBe(String(MAX_HISTORY + 5))
  })

  it('is empty-safe', () => {
    expect(currentRef([])).toBeNull()
    expect(canGoBack([])).toBe(false)
    expect(popHistory([])).toEqual([])
  })
})

describe('formatRetrieved', () => {
  it.each([
    ['2026-10-09', 'October 9, 2026'],
    ['2025-01-31', 'January 31, 2025'],
    ['2025-13-01', '2025-13-01'],
    ['yesterday', 'yesterday'],
  ])('%s -> %s', (iso, out) => {
    expect(formatRetrieved(iso)).toBe(out)
  })
})
