// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cite } from './Cite'
import { PdfPanelContext, type PdfPanelApi } from './usePdfPanel'
import { StatutePanelContext, type StatutePanelApi } from './useStatutePanel'

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

function fakeStatutes(): StatutePanelApi {
  return {
    isOpen: false,
    current: null,
    nonce: 0,
    canGoBack: false,
    openStatute: vi.fn(),
    navigate: vi.fn(),
    back: vi.fn(),
    close: vi.fn(),
  }
}

function renderCite(
  panel: PdfPanelApi | null,
  props: Parameters<typeof Cite>[0],
  statutes: StatutePanelApi | null = fakeStatutes(),
) {
  render(
    <PdfPanelContext.Provider value={panel}>
      <StatutePanelContext.Provider value={statutes}>
        <Cite {...props} />
      </StatutePanelContext.Provider>
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
  it('keeps the azleg.gov href, opening in a new tab', () => {
    renderCite(fakePanel(), { epmPage: 211, statute: '16-584(B)' })
    const link = screen.getByRole('link', { name: /A\.R\.S/ })
    expect(link.getAttribute('href')).toBe('https://www.azleg.gov/ars/16/00584.htm')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
  })

  it('a plain click opens the statute panel at the ref, not the PDF panel', () => {
    const panel = fakePanel()
    const statutes = fakeStatutes()
    renderCite(panel, { epmPage: 211, statute: '16-579(A)(1)' }, statutes)
    expect(click(screen.getByRole('link', { name: /A\.R\.S/ }))).toBe(true)
    expect(statutes.openStatute).toHaveBeenCalledExactlyOnceWith('16-579(A)(1)')
    expect(panel.openAt).not.toHaveBeenCalled()
  })

  it.each([
    ['cmd', { metaKey: true }],
    ['ctrl', { ctrlKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle', { button: 1 }],
  ])('%s-click leaves the browser default alone', (_, mods) => {
    const statutes = fakeStatutes()
    renderCite(fakePanel(), { statute: '16-579(A)(1)' }, statutes)
    expect(click(screen.getByRole('link', { name: /A\.R\.S/ }), mods)).toBe(false)
    expect(statutes.openStatute).not.toHaveBeenCalled()
  })

  it('without a statute panel provider, a plain click falls through to azleg.gov', () => {
    renderCite(fakePanel(), { statute: '16-579' }, null)
    expect(click(screen.getByRole('link', { name: /A\.R\.S/ }))).toBe(false)
  })

  it.each(['Const. Art. IV, Pt. 1, § 1(3)', '52 U.S.C. § 21082(c)', 'Procedures Manual'])(
    'renders %j as plain text, not a link',
    (statute) => {
      const statutes = fakeStatutes()
      renderCite(fakePanel(), { statute }, statutes)
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByText(statute)).toBeTruthy()
    },
  )
})
