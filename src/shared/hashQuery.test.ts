import { describe, expect, it } from 'vitest'
import { getHashParam, joinHash, setHashParam, splitHash } from './hashQuery'

describe('splitHash', () => {
  it.each([
    ['', ''],
    ['#', ''],
    ['#/', ''],
    ['#/calendar', 'calendar'],
    ['#calendar', 'calendar'],
    ['#/calendar?election=NOV_EV', 'calendar'],
    ['#/?pdf=1', ''],
    ['#?pdf=1', ''],
    ['#/ballot-guide/step/2?pdf=5', 'ballot-guide/step/2'],
  ])('%j has path %j', (hash, path) => {
    expect(splitHash(hash).path).toBe(path)
  })

  it('reads params after the first "?" only', () => {
    const { params } = splitHash('#/calendar?election=NOV_EV&pdf=304')
    expect(params.get('election')).toBe('NOV_EV')
    expect(params.get('pdf')).toBe('304')
  })

  it('keeps a "?" inside a param value', () => {
    expect(splitHash('#/x?q=a?b').params.get('q')).toBe('a?b')
  })
})

describe('getHashParam', () => {
  it('returns null when missing or the hash is empty or malformed', () => {
    expect(getHashParam('', 'pdf')).toBeNull()
    expect(getHashParam('#', 'pdf')).toBeNull()
    expect(getHashParam('#/calendar', 'pdf')).toBeNull()
    expect(getHashParam('#/calendar?', 'pdf')).toBeNull()
    expect(getHashParam('#/calendar?&&=&pdf', 'pdf')).toBe('')
    expect(getHashParam('#/calendar?%E0%A4%A', 'pdf')).toBeNull()
  })

  it('decodes values', () => {
    expect(getHashParam('#/x?name=a%20b', 'name')).toBe('a b')
  })
})

describe('setHashParam', () => {
  it('adds the param to a bare route', () => {
    expect(setHashParam('#/calendar', 'pdf', '304')).toBe('#/calendar?pdf=304')
  })

  it('adds the param to an empty hash at the home route', () => {
    expect(setHashParam('', 'pdf', '1')).toBe('#/?pdf=1')
    expect(setHashParam('#', 'pdf', '1')).toBe('#/?pdf=1')
  })

  it('preserves other params when adding', () => {
    expect(setHashParam('#/calendar?election=NOV_EV', 'pdf', '304')).toBe('#/calendar?election=NOV_EV&pdf=304')
  })

  it('replaces an existing value in place', () => {
    expect(setHashParam('#/calendar?pdf=1&election=NOV_EV', 'pdf', '2')).toBe('#/calendar?pdf=2&election=NOV_EV')
  })

  it('removes the param on null and keeps the others', () => {
    expect(setHashParam('#/calendar?election=NOV_EV&pdf=304', 'pdf', null)).toBe('#/calendar?election=NOV_EV')
  })

  it('drops the "?" when the last param is removed', () => {
    expect(setHashParam('#/calendar?pdf=304', 'pdf', null)).toBe('#/calendar')
    expect(setHashParam('#/?pdf=304', 'pdf', null)).toBe('#/')
  })

  it('is a no-op shape-wise when removing a missing param', () => {
    expect(setHashParam('#/calendar?election=NOV_EV', 'pdf', null)).toBe('#/calendar?election=NOV_EV')
  })

  it('encodes values', () => {
    expect(setHashParam('#/x', 'q', 'a b&c')).toBe('#/x?q=a+b%26c')
  })
})

describe('route + query round-trip', () => {
  it.each(['#/', '#/calendar', '#/calendar?election=NOV_EV', '#/calendar?election=NOV_EV&pdf=304', '#/a/b?x=1&y=2'])(
    'joinHash(splitHash(%j)) is unchanged',
    (hash) => {
      expect(joinHash(splitHash(hash))).toBe(hash)
    },
  )

  it('normalizes a missing leading slash', () => {
    expect(joinHash(splitHash('#calendar?x=1'))).toBe('#/calendar?x=1')
  })

  it('open then close restores the original hash', () => {
    const start = '#/calendar?election=NOV_EV'
    expect(setHashParam(setHashParam(start, 'pdf', '304'), 'pdf', null)).toBe(start)
  })
})
