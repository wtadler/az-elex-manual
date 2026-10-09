// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cite } from './Cite'
import { PdfPanelContext, type PdfPanelApi } from './usePdfPanel'

function fakePanel(): PdfPanelApi {
  return {
    isOpen: false,
    target: { pdfPage: 1, nonce: 0 },
    openAt: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    reportPage: vi.fn(),
  }
}

function renderCite(panel: PdfPanelApi | null, props: Parameters<typeof Cite>[0]) {
  render(
    <PdfPanelContext.Provider value={panel}>
      <Cite {...props} />
    </PdfPanelContext.Provider>,
  )
}

/** Dispatches a click and reports whether the app called preventDefault on it. */
function click(el: HTMLElement, init: MouseEventInit = {}): boolean {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  el.dispatchEvent(event)
  return event.defaultPrevented
}

afterEach(cleanup)

describe('Cite EPM link', () => {
  it('keeps the raw PDF href at the PDF page, opening in a new tab', () => {
    renderCite(fakePanel(), { epmPage: 304 })
    const link = screen.getByRole('link', { name: /EPM p/ })
    expect(link.getAttribute('href')).toMatch(/epm\.pdf#page=318$/)
    expect(link.getAttribute('target')).toBe('_blank')
  })

  it('a plain click opens the panel at the printed page and prevents navigation', () => {
    const panel = fakePanel()
    renderCite(panel, { epmPage: 304 })
    const prevented = click(screen.getByRole('link', { name: /EPM p/ }))
    expect(prevented).toBe(true)
    expect(panel.openAt).toHaveBeenCalledExactlyOnceWith(304)
  })

  it.each([
    ['cmd', { metaKey: true }],
    ['ctrl', { ctrlKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
  ])('%s-click leaves the browser default alone', (_, mods) => {
    const panel = fakePanel()
    renderCite(panel, { epmPage: 211 })
    const prevented = click(screen.getByRole('link', { name: /EPM p/ }), mods)
    expect(prevented).toBe(false)
    expect(panel.openAt).not.toHaveBeenCalled()
  })

  it('middle click (auxclick, button 1) does not open the panel', () => {
    const panel = fakePanel()
    renderCite(panel, { epmPage: 211 })
    const link = screen.getByRole('link', { name: /EPM p/ })
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }))
    expect(click(link, { button: 1 })).toBe(false)
    expect(panel.openAt).not.toHaveBeenCalled()
  })

  it('without a panel provider, a plain click falls through to the href', () => {
    renderCite(null, { epmPage: 211 })
    expect(click(screen.getByRole('link', { name: /EPM p/ }))).toBe(false)
  })
})

describe('Cite statute link', () => {
  it('still goes to azleg.gov in a new tab and never opens the panel', () => {
    const panel = fakePanel()
    renderCite(panel, { epmPage: 211, statute: '16-584(B)' })
    const link = screen.getByRole('link', { name: /A\.R\.S/ })
    expect(link.getAttribute('href')).toBe('https://www.azleg.gov/ars/16/00584.htm')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(click(link)).toBe(false)
    expect(panel.openAt).not.toHaveBeenCalled()
  })
})
