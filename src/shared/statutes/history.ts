// The statute panel's back stack: refs the reader opened, most recent last.

export const MAX_HISTORY = 50

/** Starts over at `ref` (opening from outside the panel). */
export function resetHistory(ref: string): string[] {
  return [ref]
}

/** Follows a link inside the panel. Re-opening the current ref doesn't add an entry. */
export function pushHistory(stack: string[], ref: string): string[] {
  if (stack[stack.length - 1] === ref) return stack
  const next = [...stack, ref]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

/** Goes back one step. The first entry stays. */
export function popHistory(stack: string[]): string[] {
  return stack.length > 1 ? stack.slice(0, -1) : stack
}

export function canGoBack(stack: string[]): boolean {
  return stack.length > 1
}

export function currentRef(stack: string[]): string | null {
  return stack[stack.length - 1] ?? null
}
