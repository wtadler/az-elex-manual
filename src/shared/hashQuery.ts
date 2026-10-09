// Helpers for the query part of a hash route: "#/calendar?election=NOV_EV&pdf=211".
// Routes live before the "?", parameters after it. Every helper preserves params it doesn't touch.

export interface HashParts {
  /** Route path without the leading "#/", e.g. "calendar". */
  path: string
  params: URLSearchParams
}

/** Splits a location.hash value ("#/calendar?x=1", "", "#") into route path and params. */
export function splitHash(hash: string): HashParts {
  const raw = hash.replace(/^#/, '')
  const q = raw.indexOf('?')
  const pathPart = q === -1 ? raw : raw.slice(0, q)
  const query = q === -1 ? '' : raw.slice(q + 1)
  return { path: pathPart.replace(/^\/+/, ''), params: new URLSearchParams(query) }
}

/** Joins route path and params back into a hash string: "#/calendar?x=1", or "#/" for home. */
export function joinHash({ path, params }: HashParts): string {
  // Parentheses are legal in a fragment; leave them readable in statute refs ("ars=16-579(A)(1)").
  const query = params.toString().replaceAll('%28', '(').replaceAll('%29', ')')
  return `#/${path}${query ? `?${query}` : ''}`
}

/** Reads one param from a hash, or null if it isn't there. */
export function getHashParam(hash: string, key: string): string | null {
  return splitHash(hash).params.get(key)
}

/** Returns the hash with `key` set to `value`, or removed when `value` is null. Other params are kept. */
export function setHashParam(hash: string, key: string, value: string | null): string {
  const parts = splitHash(hash)
  if (value == null) parts.params.delete(key)
  else parts.params.set(key, value)
  return joinHash(parts)
}
