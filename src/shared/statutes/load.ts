import type { StatuteDoc, StatuteIndex } from './types'

export const STATUTES_BASE = `${import.meta.env.BASE_URL}statutes/`

/** Thrown when a section file isn't there (404), as opposed to a network or parse failure. */
export class StatuteNotFound extends Error {}

const cache = new Map<string, Promise<unknown>>()

function getJson<T>(file: string): Promise<T> {
  let p = cache.get(file) as Promise<T> | undefined
  if (!p) {
    p = fetch(STATUTES_BASE + file).then((res) => {
      if (res.status === 404) throw new StatuteNotFound(file)
      if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
      return res.json() as Promise<T>
    })
    // Keep successes and 404s; let other failures retry on the next open.
    p.catch((err: unknown) => {
      if (!(err instanceof StatuteNotFound)) cache.delete(file)
    })
    cache.set(file, p)
  }
  return p
}

/** public/statutes/index.json, fetched once per session. */
export function loadStatuteIndex(): Promise<StatuteIndex> {
  return getJson<StatuteIndex>('index.json')
}

/** public/statutes/<id>.json, fetched once per section per session. */
export function loadStatute(id: string): Promise<StatuteDoc> {
  return getJson<StatuteDoc>(`${encodeURIComponent(id)}.json`)
}

/** For tests. */
export function clearStatuteCache(): void {
  cache.clear()
}
