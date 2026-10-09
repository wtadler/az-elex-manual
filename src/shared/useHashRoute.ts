import { useEffect, useState } from 'react'

/**
 * Route id from a location hash. Ignores sub-paths and any `?query` suffix, so
 * "#/calendar?election=NOV_EV" is the "calendar" route. Features read their own query.
 */
export function routeFromHash(hash: string): string {
  return hash.replace(/^#\/?/, '').split('?')[0].split('/')[0] ?? ''
}

// Hash routing (#/calendar) because GitHub Pages has no index.html fallback for paths.
function current(): string {
  return routeFromHash(window.location.hash)
}

export function useHashRoute(): string {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onChange = () => setRoute(current())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
