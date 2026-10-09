// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatutePanelProvider } from './StatutePanelContext'
import { useStatutePanel, type StatutePanelApi } from './useStatutePanel'

const probe: { api: StatutePanelApi | null } = { api: null }
function Probe() {
  const value = useStatutePanel()
  useEffect(() => {
    probe.api = value
  })
  return null
}

function mount(hash: string) {
  history.replaceState(null, '', `/${hash}`)
  render(
    <StatutePanelProvider>
      <Probe />
    </StatutePanelProvider>,
  )
}

afterEach(() => {
  cleanup()
  probe.api = null
  history.replaceState(null, '', '/')
})

describe('StatutePanelProvider', () => {
  it('starts closed with no ars param', () => {
    mount('#/calendar?pdf=304')
    expect(probe.api!.isOpen).toBe(false)
    expect(window.location.hash).toBe('#/calendar?pdf=304')
  })

  it('opens from ars= on a fresh load and normalizes it', () => {
    mount('#/calendar?ars=A.R.S.%20%C2%A7%2016-579%28A%29%281%29&pdf=304')
    expect(probe.api!.isOpen).toBe(true)
    expect(probe.api!.current).toBe('16-579(A)(1)')
    expect(window.location.hash).toBe('#/calendar?ars=16-579(A)(1)&pdf=304')
  })

  it('ignores a non-A.R.S. ars= value', () => {
    mount('#/calendar?ars=Const.%20Art.%20IV')
    expect(probe.api!.isOpen).toBe(false)
  })

  it('writes ars= on open, keeps other params, and drops it on close', () => {
    mount('#/calendar?election=NOV_EV&pdf=304')
    act(() => probe.api!.openStatute('16-121.01(B)'))
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV&pdf=304&ars=16-121.01(B)')
    act(() => probe.api!.close())
    expect(probe.api!.isOpen).toBe(false)
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV&pdf=304')
  })

  it('ignores opening a non-A.R.S. ref', () => {
    mount('#/')
    act(() => probe.api!.openStatute('52 U.S.C. § 21082(c)'))
    expect(probe.api!.isOpen).toBe(false)
  })

  it('navigate builds history; back returns; openStatute resets it', () => {
    mount('#/')
    act(() => probe.api!.openStatute('16-579(A)'))
    expect(probe.api!.canGoBack).toBe(false)
    act(() => probe.api!.navigate('16-584'))
    expect(probe.api!.current).toBe('16-584')
    expect(probe.api!.canGoBack).toBe(true)
    expect(window.location.hash).toBe('#/?ars=16-584')
    act(() => probe.api!.back())
    expect(probe.api!.current).toBe('16-579(A)')
    expect(probe.api!.canGoBack).toBe(false)
    act(() => probe.api!.navigate('16-584'))
    act(() => probe.api!.openStatute('9-471'))
    expect(probe.api!.canGoBack).toBe(false)
  })

  it('bumps the nonce when the same ref is opened again', () => {
    mount('#/')
    act(() => probe.api!.openStatute('16-579'))
    const n = probe.api!.nonce
    act(() => probe.api!.openStatute('16-579'))
    expect(probe.api!.nonce).toBe(n + 1)
  })

  it('follows a pasted hash and re-adds ars= after tab navigation', () => {
    mount('#/')
    act(() => {
      history.replaceState(null, '', '/#/calendar?ars=16-584(B)')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(probe.api!.current).toBe('16-584(B)')
    act(() => {
      history.replaceState(null, '', '/#/ballot-guide')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(probe.api!.isOpen).toBe(true)
    expect(window.location.hash).toBe('#/ballot-guide?ars=16-584(B)')
  })
})
