import { describe, expect, it } from 'vitest'
import { START, byId, nodes } from './tree'

describe('ballot guide tree', () => {
  it('has unique ids', () => {
    expect(byId.size).toBe(nodes.length)
  })

  it('starts at an existing question', () => {
    expect(byId.get(START)?.kind).toBe('question')
  })

  it('every option points at an existing node', () => {
    for (const n of nodes) {
      if (n.kind !== 'question') continue
      for (const o of n.options) expect(byId.has(o.next), `${n.id} -> ${o.next}`).toBe(true)
    }
  })

  it('every question has at least two options', () => {
    for (const n of nodes) if (n.kind === 'question') expect(n.options.length).toBeGreaterThanOrEqual(2)
  })

  it('every node cites the manual or a statute', () => {
    for (const n of nodes) {
      expect(n.cites.length, n.id).toBeGreaterThan(0)
      for (const c of n.cites) expect(c.epmPage != null || !!c.statute, n.id).toBe(true)
    }
  })

  it('every node is reachable from the start, with no cycles', () => {
    const seen = new Set<string>()
    const walk = (id: string, path: string[]) => {
      expect(path, `cycle at ${id}`).not.toContain(id)
      seen.add(id)
      const n = byId.get(id)!
      if (n.kind === 'question') for (const o of n.options) walk(o.next, [...path, id])
    }
    walk(START, [])
    expect([...seen].sort()).toEqual(nodes.map((n) => n.id).sort())
  })
})
