import { describe, expect, it } from 'vitest'
import { row } from './fixtures'
import { buildIcs, entryUid, escapeText, foldLine, icsTimestamp, type IcsOptions } from './ics'

const opts: IcsOptions = {
  baseUrl: 'https://example.org/az-elex-manual/#/calendar?election=A',
  now: new Date(Date.UTC(2026, 9, 9, 15, 4, 5)),
  electionLabels: new Map([['A', 'March 11, 2025']]),
}
const octets = (s: string) => new TextEncoder().encode(s).length

/** Undo folding: a CRLF followed by one space joins to the previous line. */
const unfold = (ics: string) => ics.replace(/\r\n /g, '')
const prop = (ics: string, name: string) =>
  unfold(ics)
    .split('\r\n')
    .filter((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`))

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma, and newlines', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf\rg')).toBe('a\\\\b\\;c\\,d\\ne\\nf\\ng')
  })

  it('escapes backslash before adding escapes', () => {
    expect(escapeText('\\,')).toBe('\\\\\\,')
  })

  it('leaves colons and quotes alone', () => {
    expect(escapeText('Note: "x"')).toBe('Note: "x"')
  })
})

describe('foldLine', () => {
  it('leaves a 75-octet line alone', () => {
    const line = 'X'.repeat(75)
    expect(foldLine(line)).toBe(line)
  })

  it('folds a 76-octet line', () => {
    expect(foldLine('X'.repeat(76))).toBe(`${'X'.repeat(75)}\r\n X`)
  })

  it('keeps every physical line at or under 75 octets and unfolds losslessly', () => {
    const line = `DESCRIPTION:${'abcdefghij'.repeat(40)}`
    const folded = foldLine(line)
    for (const l of folded.split('\r\n')) expect(octets(l)).toBeLessThanOrEqual(75)
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true)
    expect(unfold(folded)).toBe(line)
  })

  it.each([
    ['2-byte', 'é'],
    ['3-byte', '§'],
    ['4-byte', '🗳'],
  ])('never splits a %s character', (_, ch) => {
    for (let pad = 0; pad < 4; pad++) {
      const line = 'S'.repeat(pad) + ch.repeat(60)
      const folded = foldLine(line)
      for (const l of folded.split('\r\n')) {
        expect(octets(l)).toBeLessThanOrEqual(75)
        // A split character would decode to U+FFFD.
        expect(new TextDecoder().decode(new TextEncoder().encode(l))).not.toContain('�')
      }
      expect(unfold(folded)).toBe(line)
    }
  })
})

describe('icsTimestamp', () => {
  it('formats UTC with a Z', () => {
    expect(icsTimestamp(opts.now)).toBe('20261009T150405Z')
  })
})

describe('entryUid', () => {
  it('is stable for the same row', () => {
    expect(entryUid(row())).toBe(entryUid(row()))
    expect(entryUid(row())).toMatch(/^[0-9a-f]{16}@az-elex-manual$/)
  })

  it('ignores fields outside date, election, and event', () => {
    expect(entryUid(row({ epmPage: 310, statutes: [], offices: ['SOS'] }))).toBe(entryUid(row()))
  })

  it('differs when date, election, or event differs', () => {
    const uids = new Set([
      entryUid(row()),
      entryUid(row({ date: '2026-01-16' })),
      entryUid(row({ election: 'TEST_B' })),
      entryUid(row({ election: null })),
      entryUid(row({ event: 'Sample deadline.' })),
    ])
    expect(uids.size).toBe(5)
  })

  it('is unique across many similar rows', () => {
    const uids = new Set<string>()
    for (let i = 0; i < 500; i++) uids.add(entryUid(row({ event: `Deadline ${i}` })))
    expect(uids.size).toBe(500)
  })
})

describe('buildIcs', () => {
  it('produces a valid empty calendar', () => {
    const ics = buildIcs([], opts)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('PRODID:')
    expect(ics).not.toContain('VEVENT')
  })

  it('uses CRLF only', () => {
    const ics = buildIcs([row({ event: 'Line one\nline two' })], opts)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('folds every line to 75 octets', () => {
    const ics = buildIcs(
      [row({ event: `Very long event § ${'é'.repeat(100)}`, weekendNote: 'Saturday. Moves to next business day.' })],
      opts,
    )
    for (const l of ics.split('\r\n')) expect(octets(l)).toBeLessThanOrEqual(75)
  })

  it('writes an all-day event ending the next day', () => {
    const ics = buildIcs([row({ date: '2025-03-11' })], opts)
    expect(prop(ics, 'DTSTART')).toEqual(['DTSTART;VALUE=DATE:20250311'])
    expect(prop(ics, 'DTEND')).toEqual(['DTEND;VALUE=DATE:20250312'])
    expect(prop(ics, 'DTSTAMP')).toEqual(['DTSTAMP:20261009T150405Z'])
  })

  it.each([
    ['2025-01-31', '20250201'],
    ['2025-02-28', '20250301'],
    ['2024-02-29', '20240301'],
    ['2025-12-31', '20260101'],
  ])('DTEND after %s is %s', (date, end) => {
    expect(prop(buildIcs([row({ date })], opts), 'DTEND')).toEqual([`DTEND;VALUE=DATE:${end}`])
  })

  it('sets SUMMARY to the escaped event', () => {
    const ics = buildIcs([row({ event: 'Deadline; notify county, then post' })], opts)
    expect(prop(ics, 'SUMMARY')).toEqual(['SUMMARY:Deadline\\; notify county\\, then post'])
  })

  it('describes offices, statutes, weekend note, election, and EPM page', () => {
    const ics = buildIcs(
      [
        row({
          election: 'A',
          offices: ['REC', 'BOS'],
          statutes: ['16-544(F)', 'Procedures Manual'],
          weekendNote: 'Saturday. Moves to next business day.',
          epmPage: 304,
        }),
      ],
      opts,
    )
    const [desc] = prop(ics, 'DESCRIPTION')
    expect(desc).toContain('Election: March 11\\, 2025')
    expect(desc).toContain('Offices: County Recorder\\, Board of Supervisors')
    expect(desc).toContain('Statutes: 16-544(F)\\, Procedures Manual')
    expect(desc).toContain('Weekend/holiday: Saturday. Moves to next business day.')
    expect(desc).toContain('Procedures Manual\\, p. 304')
    expect(desc).toContain('\\n')
  })

  it('omits empty description parts and labels cycle-wide rows', () => {
    const [desc] = prop(buildIcs([row({ election: null, offices: [], statutes: [], weekendNote: null })], opts), 'DESCRIPTION')
    expect(desc).not.toContain('Offices:')
    expect(desc).not.toContain('Statutes:')
    expect(desc).not.toContain('Weekend')
    expect(desc).toContain('All elections/cycle-wide')
  })

  it('links to the absolute PDF page', () => {
    const ics = buildIcs([row({ epmPage: 304 })], opts)
    const [url] = prop(ics, 'URL')
    expect(url).toMatch(/^URL:https:\/\/example\.org\/.*epm\.pdf#page=318$/)
  })

  it('emits one event per row with unique UIDs, even for duplicate rows', () => {
    const ics = buildIcs([row(), row(), row({ event: 'Other' }), row()], opts)
    const uids = prop(ics, 'UID')
    expect(uids).toHaveLength(4)
    expect(new Set(uids).size).toBe(4)
    expect(uids[0]).toBe(`UID:${entryUid(row())}`)
    expect(uids[1]).toMatch(/-2@az-elex-manual$/)
    expect(uids[3]).toMatch(/-3@az-elex-manual$/)
  })

  it('is deterministic for the same input', () => {
    expect(buildIcs([row()], opts)).toBe(buildIcs([row()], opts))
  })
})
