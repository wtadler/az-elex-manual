import { describe, expect, it } from 'vitest'
import { routeFromHash } from './useHashRoute'

describe('routeFromHash', () => {
  it.each([
    ['', ''],
    ['#', ''],
    ['#/', ''],
    ['#/calendar', 'calendar'],
    ['#calendar', 'calendar'],
    ['#/calendar/', 'calendar'],
    ['#/calendar?election=NOV_EV', 'calendar'],
    ['#/calendar?election=NOV_EV&office=REC,BOS', 'calendar'],
    ['#/calendar/sub?x=1', 'calendar'],
    ['#/?q=1', ''],
    ['#?q=1', ''],
    ['#/ballot-guide', 'ballot-guide'],
  ])('%j -> %j', (hash, route) => {
    expect(routeFromHash(hash)).toBe(route)
  })
})
