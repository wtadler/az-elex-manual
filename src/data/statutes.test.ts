import { describe, expect, it } from 'vitest'
import calendar from './calendar.json'
import index from '../../public/statutes/index.json'

// Guards the contract between scripts/fetch_statutes.py and the statute viewer UI.
interface StatuteIndex {
  retrieved: string
  source: string
  sections: Record<string, string>
  missing: Record<string, string>
}

interface Statute {
  id: string
  title: string
  url: string
  retrieved: string
  notes: string[]
  paragraphs: string[]
}

const idx = index as StatuteIndex
const modules = import.meta.glob<{ default: unknown }>('../../public/statutes/*.json', { eager: true })
const files = new Map<string, Statute>()
for (const [path, mod] of Object.entries(modules)) {
  const name = path.split('/').pop()!.replace(/\.json$/, '')
  if (name !== 'index') files.set(name, mod.default as Statute)
}

const ID = /^\d{1,2}-\d{3,4}(\.\d{2,3})?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

function idToUrl(id: string): string {
  const [title, section] = id.split('-')
  const [base, sub] = section.split('.')
  return `https://www.azleg.gov/ars/${Number(title)}/${base.padStart(5, '0')}${sub ? `-${sub}` : ''}.htm`
}

function sortKey(id: string): number[] {
  const [title, section] = id.split('-')
  const [base, sub] = section.split('.')
  return [Number(title), Number(base), sub ? Number(sub) : -1]
}

function compareIds(a: string, b: string): number {
  const ka = sortKey(a)
  const kb = sortKey(b)
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]
  return 0
}

describe('public/statutes/index.json', () => {
  it('has the contract shape', () => {
    expect(idx.retrieved).toMatch(DATE)
    expect(idx.source).toBe('https://www.azleg.gov/arstitle/')
    expect(Object.keys(idx.sections).length).toBeGreaterThan(200)
    for (const [id, title] of Object.entries(idx.sections)) {
      expect(id).toMatch(ID)
      expect(title.trim()).not.toBe('')
    }
    for (const [id, reason] of Object.entries(idx.missing)) {
      expect(id).toMatch(ID)
      expect(reason.trim()).not.toBe('')
      expect(idx.sections).not.toHaveProperty(id)
    }
  })

  it('is sorted numerically by title, then section', () => {
    const ids = Object.keys(idx.sections)
    expect(ids).toEqual([...ids].sort(compareIds))
    const missing = Object.keys(idx.missing)
    expect(missing).toEqual([...missing].sort(compareIds))
  })

  it('has a file for every section, and no stray files', () => {
    expect([...files.keys()].sort()).toEqual(Object.keys(idx.sections).sort())
  })

  it('covers every A.R.S. section the calendar cites', () => {
    const cited = new Set<string>()
    for (const entry of calendar) {
      for (const s of entry.statutes) {
        const m = /^(\d{1,2}-\d+(?:\.\d+)?)/.exec(s)
        if (m) cited.add(m[1])
      }
    }
    expect(cited.size).toBeGreaterThan(50)
    for (const id of cited) {
      expect(id in idx.sections || id in idx.missing, `${id} in index`).toBe(true)
    }
  })
})

describe.each([...files.entries()])('public/statutes/%s.json', (name, s) => {
  it('matches the contract', () => {
    expect(Object.keys(s).sort()).toEqual(['id', 'notes', 'paragraphs', 'retrieved', 'title', 'url'])
    expect(s.id).toBe(name)
    expect(s.title).toBe(idx.sections[name])
    expect(s.url).toBe(idToUrl(s.id))
    expect(s.retrieved).toMatch(DATE)
    expect(Array.isArray(s.notes)).toBe(true)
    expect(s.paragraphs.length).toBeGreaterThan(0)
    for (const p of [...s.notes, ...s.paragraphs]) {
      expect(typeof p).toBe('string')
      expect(p).not.toBe('')
      expect(p).not.toMatch(/\s{2,}|^\s|\s$| |<\/?[a-z]+[ >]|&(nbsp|quot|amp|#\d+);/i)
    }
    // The heading ("16-579. Procedure for ...") is id + title, not a paragraph.
    expect(s.paragraphs[0].startsWith(`${s.id}.`)).toBe(false)
  })
})

describe('16-579', () => {
  it('contains the conditional provisional ballot rule', () => {
    const s = files.get('16-579')!
    expect(s.title).toBe('Procedure for obtaining ballot by elector')
    expect(s.paragraphs.join('\n')).toContain('conditional provisional ballot')
  })
})
