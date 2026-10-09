// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openInPanelOnPlainClick } from './clicks'
import { PanelLink } from './PanelLink'

/** Dispatches a click and reports whether the app called preventDefault on it. */
function click(el: HTMLElement, init: MouseEventInit = {}): boolean {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  el.dispatchEvent(event)
  return event.defaultPrevented
}

afterEach(cleanup)

describe('PanelLink', () => {
  it('renders a real new-tab link', () => {
    render(<PanelLink href="https://example.test/a" onOpen={vi.fn()}>A</PanelLink>)
    const link = screen.getByRole('link', { name: 'A' })
    expect(link.getAttribute('href')).toBe('https://example.test/a')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('a plain click calls onOpen and prevents navigation', () => {
    const onOpen = vi.fn()
    render(<PanelLink href="https://example.test/a" onOpen={onOpen}>A</PanelLink>)
    expect(click(screen.getByRole('link'))).toBe(true)
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it.each([
    ['cmd', { metaKey: true }],
    ['ctrl', { ctrlKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle', { button: 1 }],
    ['right', { button: 2 }],
  ])('%s-click leaves the browser default alone', (_, init) => {
    const onOpen = vi.fn()
    render(<PanelLink href="https://example.test/a" onOpen={onOpen}>A</PanelLink>)
    expect(click(screen.getByRole('link'), init)).toBe(false)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('without onOpen it is an ordinary link', () => {
    render(<PanelLink href="https://example.test/a">A</PanelLink>)
    expect(click(screen.getByRole('link'))).toBe(false)
  })

  it('passes through className, aria, title, style, and other anchor props', () => {
    render(
      <PanelLink
        href="https://example.test/a"
        className="x"
        aria-label="Label"
        title="Tip"
        style={{ left: '5%' }}
        tabIndex={-1}
        draggable={false}
      />,
    )
    const link = screen.getByRole('link', { name: 'Label' })
    expect(link.className).toBe('x')
    expect(link.getAttribute('title')).toBe('Tip')
    expect(link.style.left).toBe('5%')
    expect(link.getAttribute('tabindex')).toBe('-1')
    expect(link.getAttribute('draggable')).toBe('false')
  })
})

describe('openInPanelOnPlainClick', () => {
  const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }

  it('opens and prevents default on a plain click', () => {
    const e = { ...plain, preventDefault: vi.fn() }
    const onOpen = vi.fn()
    openInPanelOnPlainClick(e, onOpen)
    expect(e.preventDefault).toHaveBeenCalledOnce()
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('does nothing when the event was already handled', () => {
    const e = { ...plain, defaultPrevented: true, preventDefault: vi.fn() }
    const onOpen = vi.fn()
    openInPanelOnPlainClick(e, onOpen)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does nothing without onOpen', () => {
    const e = { ...plain, preventDefault: vi.fn() }
    openInPanelOnPlainClick(e, undefined)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
