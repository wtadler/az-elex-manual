import { epmPdfUrl } from '../../shared/citation'
import type { CalendarEntry } from '../../shared/types'
import { addDays, electionLabel, OFFICE_NAMES } from './labels'

// iCalendar (RFC 5545) export of calendar rows as all-day events.

const CRLF = '\r\n'
const MAX_OCTETS = 75
const encoder = new TextEncoder()

/** Escapes a TEXT value: backslash, semicolon, comma, and newlines (RFC 5545 §3.3.11). */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Folds a content line so no physical line exceeds 75 octets (RFC 5545 §3.1).
 * Continuation lines start with a space, which counts toward their 75. Never
 * splits a multibyte UTF-8 character.
 */
export function foldLine(line: string): string {
  const out: string[] = []
  let current = ''
  let octets = 0
  for (const ch of line) {
    const n = encoder.encode(ch).length
    if (octets + n > MAX_OCTETS) {
      out.push(current)
      current = ' '
      octets = 1
    }
    current += ch
    octets += n
  }
  out.push(current)
  return out.join(CRLF)
}

/** "2025-03-11" -> "20250311" */
function icsDate(iso: string): string {
  return iso.replaceAll('-', '')
}

/** UTC timestamp, "20261009T151500Z". */
export function icsTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** FNV-1a, two 32-bit lanes with different seeds, as 16 hex chars. */
function hash(s: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x5bd1e995
  for (const byte of encoder.encode(s)) {
    a = Math.imul(a ^ byte, 0x01000193)
    b = Math.imul(b ^ byte, 0x01000193)
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')
}

/** UID for a row: stable across exports, derived from its date, election, and event. */
export function entryUid(e: CalendarEntry): string {
  return `${hash(`${e.date}|${e.election ?? ''}|${e.event}`)}@az-elex-manual`
}

export interface IcsOptions {
  /** Absolute URL the PDF link resolves against, normally window.location.href. */
  baseUrl: string
  /** DTSTAMP for every event. */
  now: Date
  /** Election code -> label, e.g. "NOV_EV" -> "November 3, 2026". */
  electionLabels: Map<string, string>
}

function eventLines(e: CalendarEntry, uid: string, o: IcsOptions): string[] {
  const pdf = new URL(epmPdfUrl(e.epmPage), o.baseUrl).href
  const description = [
    `Election: ${electionLabel(e.election, o.electionLabels)}`,
    e.offices.length > 0 && `Offices: ${e.offices.map((x) => OFFICE_NAMES[x]).join(', ')}`,
    e.statutes.length > 0 && `Statutes: ${e.statutes.join(', ')}`,
    e.weekendNote && `Weekend/holiday: ${e.weekendNote}`,
    `Source: 2025 Arizona Elections Procedures Manual, p. ${e.epmPage}: ${pdf}`,
  ]
    .filter(Boolean)
    .join('\n')
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsTimestamp(o.now)}`,
    `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(e.date, 1))}`,
    `SUMMARY:${escapeText(e.event)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${pdf}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ]
}

/** A complete VCALENDAR for the rows, with CRLF line endings and folded lines. */
export function buildIcs(entries: CalendarEntry[], o: IcsOptions): string {
  const seen = new Map<string, number>()
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AZ Elections Manual (unofficial)//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Arizona election calendar (unofficial)',
  ]
  for (const e of entries) {
    // Identical rows would share a UID; suffix repeats so every event stays distinct.
    const base = entryUid(e)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    const uid = n === 1 ? base : base.replace('@', `-${n}@`)
    lines.push(...eventLines(e, uid, o))
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join(CRLF) + CRLF
}
