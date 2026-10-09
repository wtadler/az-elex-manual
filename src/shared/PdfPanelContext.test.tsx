// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { PdfPanelProvider } from './PdfPanelContext'
import { StatutePanelProvider } from './StatutePanelContext'
import { usePdfPanel, type PdfPanelApi } from './usePdfPanel'
import { useStatutePanel, type StatutePanelApi } from './useStatutePanel'

const probe: { pdf: PdfPanelApi | null; ars: StatutePanelApi | null } = { pdf: null, ars: null }
function Probe() {
  const pdf = usePdfPanel()
  const ars = useStatutePanel()
  useEffect(() => {
    probe.pdf = pdf
    probe.ars = ars
  })
  return null
}

function mount(hash: string) {
  history.replaceState(null, '', `/${hash}`)
  render(
    <PdfPanelProvider>
      <StatutePanelProvider>
        <Probe />
      </StatutePanelProvider>
    </PdfPanelProvider>,
  )
}

function goToHash(hash: string) {
  act(() => {
    history.replaceState(null, '', `/${hash}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

afterEach(() => {
  cleanup()
  probe.pdf = probe.ars = null
  history.replaceState(null, '', '/')
})

describe('PdfPanelProvider', () => {
  it('starts closed with no pdf param', () => {
    mount('#/calendar')
    expect(probe.pdf!.isOpen).toBe(false)
    expect(window.location.hash).toBe('#/calendar')
  })

  it('opens from pdf= on a fresh load at the printed page', () => {
    mount('#/calendar?pdf=211')
    expect(probe.pdf!.isOpen).toBe(true)
    expect(probe.pdf!.target.pdfPage).toBe(225)
    expect(window.location.hash).toBe('#/calendar?pdf=211')
  })

  it('writes pdf= on open and follows reportPage, dropping it on close', () => {
    mount('#/calendar?election=NOV_EV')
    act(() => probe.pdf!.openAt(304))
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV&pdf=304')
    act(() => probe.pdf!.reportPage(319))
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV&pdf=305')
    act(() => probe.pdf!.close())
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV')
  })

  it('drops pdf= while open on the unnumbered front matter', () => {
    mount('#/?pdf=1')
    act(() => probe.pdf!.reportPage(3))
    expect(probe.pdf!.isOpen).toBe(true)
    expect(window.location.hash).toBe('#/')
  })

  it('follows a pasted pdf= and re-adds it after tab navigation', () => {
    mount('#/')
    goToHash('#/calendar?pdf=304')
    expect(probe.pdf!.isOpen).toBe(true)
    expect(probe.pdf!.target.pdfPage).toBe(318)
    goToHash('#/ballot-guide')
    expect(probe.pdf!.isOpen).toBe(true)
    expect(window.location.hash).toBe('#/ballot-guide?pdf=304')
  })

  it('does not re-target when a pasted value clamps to the page already shown', () => {
    mount('#/?pdf=9999')
    const nonce = probe.pdf!.target.nonce
    goToHash('#/?pdf=5000')
    expect(probe.pdf!.target.nonce).toBe(nonce)
  })

  it('keeps pdf= and ars= together through open, tab navigation, and close', () => {
    mount('#/calendar?pdf=304')
    act(() => probe.ars!.openStatute('16-579(A)'))
    expect(window.location.hash).toBe('#/calendar?pdf=304&ars=16-579(A)')
    goToHash('#/ballot-guide')
    expect(window.location.hash).toBe('#/ballot-guide?ars=16-579(A)&pdf=304')
    act(() => probe.pdf!.close())
    expect(window.location.hash).toBe('#/ballot-guide?ars=16-579(A)')
  })
})
