// How the right-hand column is shared when both the PDF and statute panels are open.

export const SPLIT_STORAGE_KEY = 'side-panels-split'
export const DEFAULT_SPLIT = 0.55
export const MIN_SPLIT = 0.15
export const MAX_SPLIT = 0.85

/** Clamps the PDF panel's share of the column height. Non-finite input gives the default. */
export function clampSplit(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_SPLIT
  return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, ratio))
}

/** The PDF panel's share for a pointer at `clientY` over a column spanning `top`..`top + height`. */
export function splitFromPointer(clientY: number, top: number, height: number): number {
  if (height <= 0) return DEFAULT_SPLIT
  return clampSplit((clientY - top) / height)
}

/** Reads the saved ratio. Storage can be missing or throw (private windows), so that's the default. */
export function loadSplit(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): number {
  try {
    const raw = storage?.getItem(SPLIT_STORAGE_KEY)
    return raw == null ? DEFAULT_SPLIT : clampSplit(Number.parseFloat(raw))
  } catch {
    return DEFAULT_SPLIT
  }
}

export function saveSplit(ratio: number, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(SPLIT_STORAGE_KEY, clampSplit(ratio).toFixed(3))
  } catch {
    // Not saving is fine.
  }
}
