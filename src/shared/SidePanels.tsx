import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { PdfPanel } from './PdfPanel'
import { clampSplit, loadSplit, saveSplit, splitFromPointer } from './splitRatio'
import { StatutePanel } from './StatutePanel'
import { usePdfPanel } from './usePdfPanel'
import { useStatutePanel } from './useStatutePanel'

const MIN_WIDTH = 320
const KEY_STEP = 0.05

/**
 * The right-hand column: the PDF panel on top, the statute panel below, with a draggable divider
 * when both are open. Either one alone fills the column. The column's width is resizable from its
 * left edge. Under 900px wide each panel is a full-screen overlay instead (see index.css).
 */
export function SidePanels() {
  const pdf = usePdfPanel()
  const statute = useStatutePanel()
  const pdfOpen = pdf?.isOpen ?? false
  const statuteOpen = statute?.isOpen ?? false
  const [width, setWidth] = useState<number | null>(null)
  const [split, setSplit] = useState(loadSplit)
  const column = useRef<HTMLDivElement>(null)

  // Escape closes the topmost panel: the statute panel (it overlays the PDF on mobile), then the PDF.
  const closePdf = pdf?.close
  const closeStatute = statute?.close
  useEffect(() => {
    if (!pdfOpen && !statuteOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (statuteOpen) closeStatute?.()
      else if (pdfOpen) closePdf?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pdfOpen, statuteOpen, closePdf, closeStatute])

  if (!pdfOpen && !statuteOpen) return null
  const both = pdfOpen && statuteOpen

  const onResizeStart = (e: PointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const onMove = (ev: globalThis.PointerEvent) => {
      const max = window.innerWidth - MIN_WIDTH
      setWidth(Math.round(Math.min(max, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX))))
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onSplitStart = (e: PointerEvent<HTMLDivElement>) => {
    const handle = e.currentTarget
    const box = column.current?.getBoundingClientRect()
    if (!box) return
    e.preventDefault() // don't start a text selection
    handle.setPointerCapture(e.pointerId)
    let latest = split
    const onMove = (ev: globalThis.PointerEvent) => {
      latest = splitFromPointer(ev.clientY, box.top, box.height)
      setSplit(latest)
    }
    const onUp = () => {
      saveSplit(latest)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onSplitKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === 'ArrowUp' ? -KEY_STEP : e.key === 'ArrowDown' ? KEY_STEP : 0
    if (!delta) return
    e.preventDefault()
    const next = clampSplit(split + delta)
    setSplit(next)
    saveSplit(next)
  }

  return (
    <div
      ref={column}
      className={both ? 'side-column side-both' : 'side-column'}
      style={width ? ({ '--side-width': `${width}px` } as CSSProperties) : undefined}
    >
      <div
        className="side-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize side panel"
        onPointerDown={onResizeStart}
      />
      <PdfPanel style={both ? { flexGrow: split } : undefined} />
      {both && (
        <div
          className="side-split"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize PDF and statute panels"
          aria-valuemin={15}
          aria-valuemax={85}
          aria-valuenow={Math.round(split * 100)}
          tabIndex={0}
          onPointerDown={onSplitStart}
          onKeyDown={onSplitKey}
        />
      )}
      <StatutePanel style={both ? { flexGrow: 1 - split } : undefined} />
    </div>
  )
}
