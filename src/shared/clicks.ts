/** The bits of a mouse event that decide whether a click is a plain left click. */
export interface ClickLike {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}

/** True for a plain left click: the kind we take over. Modifier or non-primary clicks keep browser behavior. */
export function isPlainClick(e: ClickLike): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented
}

/**
 * onClick body for a link that has a real href but opens in an in-app panel. A plain click calls
 * `onOpen` instead of following the link; any other click, or no `onOpen`, keeps browser behavior.
 */
export function openInPanelOnPlainClick(e: ClickLike & { preventDefault(): void }, onOpen: (() => void) | undefined) {
  if (!onOpen || !isPlainClick(e)) return
  e.preventDefault()
  onOpen()
}
