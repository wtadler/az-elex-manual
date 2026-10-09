// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { replaceHash, useHashParamSync } from './useHashParamSync'

type Setter = (v: string | null) => void

/** A panel whose state is just the param value. `onExternal` is spied; by default it opens the value. */
function makePanel(param: string, opts: { parse?: (raw: string | null) => string | null; follow?: boolean } = {}) {
  const handle = {
    set: null as Setter | null,
    value: null as string | null,
    onExternal: vi.fn<(parsed: string) => void>(),
  }
  function Panel({ initial }: { initial: string | null }) {
    const [value, setValue] = useState(initial)
    useEffect(() => {
      handle.set = setValue
      handle.value = value
    }, [value])
    useHashParamSync(
      param,
      value,
      (parsed) => {
        handle.onExternal(parsed)
        if (opts.follow !== false) setValue(parsed)
      },
      opts.parse,
    )
    return null
  }
  return { handle, Panel }
}

/** Simulates the user (or a link) changing the hash: the URL changes, then hashchange fires. */
function goToHash(hash: string) {
  act(() => {
    history.replaceState(null, '', `/${hash}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

function setLocation(hash: string) {
  history.replaceState(null, '', `/${hash}`)
}

afterEach(() => {
  cleanup()
  history.replaceState(null, '', '/')
})

describe('replaceHash', () => {
  it('replaces the hash without adding a history entry', () => {
    setLocation('#/a')
    const before = history.length
    replaceHash('#/b?x=1')
    expect(window.location.hash).toBe('#/b?x=1')
    expect(history.length).toBe(before)
  })

  it('does nothing when the hash is unchanged', () => {
    setLocation('#/a?x=1')
    const spy = vi.spyOn(history, 'replaceState')
    replaceHash('#/a?x=1')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('useHashParamSync with one param', () => {
  it('leaves the hash alone when closed and the param is absent', () => {
    const { Panel } = makePanel('pdf')
    setLocation('#/calendar?election=NOV_EV')
    const spy = vi.spyOn(history, 'replaceState')
    render(<Panel initial={null} />)
    expect(spy).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV')
    spy.mockRestore()
  })

  it('writes the canonical value on a fresh load that opened from the param', () => {
    const { Panel } = makePanel('pdf')
    setLocation('#/calendar?pdf=0211&election=NOV_EV')
    render(<Panel initial="211" />)
    expect(window.location.hash).toBe('#/calendar?pdf=211&election=NOV_EV')
  })

  it('drops a param the panel could not use on a fresh load', () => {
    const { Panel } = makePanel('ars')
    setLocation('#/calendar?ars=junk&pdf=304')
    render(<Panel initial={null} />)
    expect(window.location.hash).toBe('#/calendar?pdf=304')
  })

  it('writes the param on open, keeps other params, and drops it on close', () => {
    const { handle, Panel } = makePanel('pdf')
    setLocation('#/calendar?election=NOV_EV')
    render(<Panel initial={null} />)
    act(() => handle.set!('304'))
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV&pdf=304')
    act(() => handle.set!('305'))
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV&pdf=305')
    act(() => handle.set!(null))
    expect(window.location.hash).toBe('#/calendar?election=NOV_EV')
  })

  it('re-adds the param when a tab link drops it while open', () => {
    const { handle, Panel } = makePanel('pdf')
    setLocation('#/')
    render(<Panel initial="211" />)
    goToHash('#/ballot-guide')
    expect(window.location.hash).toBe('#/ballot-guide?pdf=211')
    expect(handle.onExternal).not.toHaveBeenCalled()
  })

  it('re-adds the latest value, not the one from the first render', () => {
    const { handle, Panel } = makePanel('pdf')
    setLocation('#/')
    render(<Panel initial="211" />)
    act(() => handle.set!('212'))
    goToHash('#/ballot-guide?election=NOV_EV')
    expect(window.location.hash).toBe('#/ballot-guide?election=NOV_EV&pdf=212')
  })

  it('leaves the hash alone when a tab link has no param and the panel is closed', () => {
    const { handle, Panel } = makePanel('pdf')
    setLocation('#/')
    render(<Panel initial={null} />)
    goToHash('#/ballot-guide')
    expect(window.location.hash).toBe('#/ballot-guide')
    expect(handle.onExternal).not.toHaveBeenCalled()
  })

  it('reports a pasted value that differs from the one shown', () => {
    const { handle, Panel } = makePanel('pdf')
    setLocation('#/')
    render(<Panel initial="211" />)
    goToHash('#/calendar?pdf=304')
    expect(handle.onExternal).toHaveBeenCalledExactlyOnceWith('304')
    expect(handle.value).toBe('304')
    expect(window.location.hash).toBe('#/calendar?pdf=304')
  })

  it('reports a pasted value while closed (opening the panel)', () => {
    const { handle, Panel } = makePanel('pdf')
    setLocation('#/')
    render(<Panel initial={null} />)
    goToHash('#/calendar?pdf=304')
    expect(handle.onExternal).toHaveBeenCalledExactlyOnceWith('304')
    expect(handle.value).toBe('304')
  })

  it('ignores a hashchange to the value already shown', () => {
    const { handle, Panel } = makePanel('pdf')
    setLocation('#/')
    render(<Panel initial="211" />)
    goToHash('#/calendar?pdf=211')
    expect(handle.onExternal).not.toHaveBeenCalled()
  })

  it('canonicalizes with parse before comparing and reporting', () => {
    const parse = (raw: string | null) => (raw && /^\d+$/.test(raw) ? String(Number(raw)) : null)
    const { handle, Panel } = makePanel('pdf', { parse })
    setLocation('#/')
    render(<Panel initial="211" />)
    goToHash('#/calendar?pdf=0211')
    expect(handle.onExternal).not.toHaveBeenCalled()
    goToHash('#/calendar?pdf=0304')
    expect(handle.onExternal).toHaveBeenCalledExactlyOnceWith('304')
    expect(window.location.hash).toBe('#/calendar?pdf=304')
  })

  it('treats an unparseable value like a missing one: re-adds the shown value', () => {
    const parse = (raw: string | null) => (raw && /^\d+$/.test(raw) ? raw : null)
    const { handle, Panel } = makePanel('pdf', { parse })
    setLocation('#/')
    render(<Panel initial="211" />)
    goToHash('#/calendar?pdf=nope&election=NOV_EV')
    expect(handle.onExternal).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/calendar?pdf=211&election=NOV_EV')
  })

  it('does not rewrite the hash itself when the owner declines an external value', () => {
    const { handle, Panel } = makePanel('pdf', { follow: false })
    setLocation('#/')
    render(<Panel initial="211" />)
    goToHash('#/calendar?pdf=304')
    expect(handle.onExternal).toHaveBeenCalledOnce()
    expect(window.location.hash).toBe('#/calendar?pdf=304')
  })

  it('stops listening on unmount', () => {
    const { handle, Panel } = makePanel('pdf')
    setLocation('#/')
    const { unmount } = render(<Panel initial="211" />)
    unmount()
    goToHash('#/calendar?pdf=304')
    goToHash('#/ballot-guide')
    expect(handle.onExternal).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/ballot-guide')
  })
})

describe('useHashParamSync with pdf and ars coexisting', () => {
  function mountBoth(hash: string, pdf: string | null, ars: string | null) {
    const p = makePanel('pdf')
    const a = makePanel('ars')
    setLocation(hash)
    render(
      <>
        <p.Panel initial={pdf} />
        <a.Panel initial={ars} />
      </>,
    )
    return { pdf: p.handle, ars: a.handle }
  }

  it('fresh load with both params keeps both', () => {
    mountBoth('#/calendar?pdf=304&ars=16-579(A)', '304', '16-579(A)')
    expect(window.location.hash).toBe('#/calendar?pdf=304&ars=16-579(A)')
  })

  it('opening and closing one leaves the other in place', () => {
    const { pdf, ars } = mountBoth('#/calendar?pdf=304', '304', null)
    act(() => ars.set!('16-584'))
    expect(window.location.hash).toBe('#/calendar?pdf=304&ars=16-584')
    act(() => pdf.set!(null))
    expect(window.location.hash).toBe('#/calendar?ars=16-584')
    act(() => ars.set!(null))
    expect(window.location.hash).toBe('#/calendar')
  })

  it('re-adds both params after a tab link drops them', () => {
    const { pdf, ars } = mountBoth('#/calendar?pdf=304&ars=16-584', '304', '16-584')
    goToHash('#/ballot-guide')
    expect(window.location.hash).toBe('#/ballot-guide?pdf=304&ars=16-584')
    expect(pdf.onExternal).not.toHaveBeenCalled()
    expect(ars.onExternal).not.toHaveBeenCalled()
  })

  it('re-adds only the open panel’s param', () => {
    mountBoth('#/calendar?ars=16-584', null, '16-584')
    goToHash('#/ballot-guide')
    expect(window.location.hash).toBe('#/ballot-guide?ars=16-584')
  })

  it('a pasted link changing one param reports only to that panel', () => {
    const { pdf, ars } = mountBoth('#/calendar?pdf=304&ars=16-584', '304', '16-584')
    goToHash('#/calendar?pdf=304&ars=16-121.01')
    expect(pdf.onExternal).not.toHaveBeenCalled()
    expect(ars.onExternal).toHaveBeenCalledExactlyOnceWith('16-121.01')
    expect(window.location.hash).toBe('#/calendar?pdf=304&ars=16-121.01')
  })

  it('a pasted link with only one param opens it and re-adds the other', () => {
    const { pdf, ars } = mountBoth('#/', '304', null)
    goToHash('#/calendar?ars=9-471')
    expect(ars.onExternal).toHaveBeenCalledExactlyOnceWith('9-471')
    expect(pdf.onExternal).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/calendar?ars=9-471&pdf=304')
  })
})
