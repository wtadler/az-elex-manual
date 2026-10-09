// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatutePanelApi } from '../useStatutePanel'
import { fixture16579, fixture16584, fixtureIndex } from './fixtures'
import { clearStatuteCache } from './load'
import StatuteViewer from './StatuteViewer'

const files: Record<string, unknown> = {
  'index.json': fixtureIndex,
  '16-579.json': fixture16579,
  '16-584.json': fixture16584,
}

function fakePanel(current: string, extra: Partial<StatutePanelApi> = {}): StatutePanelApi {
  return {
    isOpen: true,
    current,
    nonce: 1,
    canGoBack: false,
    openStatute: vi.fn(),
    navigate: vi.fn(),
    back: vi.fn(),
    close: vi.fn(),
    ...extra,
  }
}

function click(el: HTMLElement, init: MouseEventInit = {}): boolean {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  el.dispatchEvent(event)
  return event.defaultPrevented
}

beforeEach(() => {
  clearStatuteCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = url.split('/').pop()!
      if (name === 'boom.json') throw new TypeError('network down')
      const body = files[decodeURIComponent(name)]
      return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('not found', { status: 404 })
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StatuteViewer', () => {
  it('shows the header, notes, paragraphs, and source line', async () => {
    render(<StatuteViewer panel={fakePanel('16-579')} />)
    expect(await screen.findByText(/Every elector shall announce/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /A\.R\.S\. §\s16-579/ })).toBeTruthy()
    expect(screen.getByText('Procedure for obtaining ballot by elector')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Open on azleg\.gov/ }).getAttribute('href')).toBe(
      'https://www.azleg.gov/ars/16/00579.htm',
    )
    expect(screen.getByText(/1998 Prop\. 105/).className).toBe('statute-note')
    expect(screen.getByText(/retrieved October 1, 2026/).textContent).toMatch(/unofficial/i)
  })

  it('indents paragraphs by level', async () => {
    const { container } = render(<StatuteViewer panel={fakePanel('16-579')} />)
    await screen.findByText(/Every elector/)
    const classes = [...container.querySelectorAll('.statute-p')].map((p) => p.className.match(/statute-level-(\d)/)?.[1])
    expect(classes).toEqual(['1', '2', '3', '3', '2', '1', '2'])
  })

  it('highlights the cited subsection', async () => {
    const { container } = render(<StatuteViewer panel={fakePanel('16-579(A)(1)(b)')} />)
    await screen.findByText(/Every elector/)
    const target = container.querySelectorAll('.is-target')
    expect(target).toHaveLength(1)
    expect(target[0].textContent).toMatch(/^\(b\) Two papers/)
  })

  it('highlights the B subsection, not the earlier 1. under A', async () => {
    const { container } = render(<StatuteViewer panel={fakePanel('16-579(B)(1)')} />)
    await screen.findByText(/Every elector/)
    expect(container.querySelector('.is-target')?.textContent).toMatch(/repeated label under B/)
  })

  it('highlights nothing when the subsection is not found', async () => {
    const { container } = render(<StatuteViewer panel={fakePanel('16-579(Z)')} />)
    await screen.findByText(/Every elector/)
    expect(container.querySelector('.is-target')).toBeNull()
  })

  it('opens cross-references the site has in the panel, and others on azleg.gov', async () => {
    const panel = fakePanel('16-579')
    render(<StatuteViewer panel={panel} />)
    await screen.findByText(/Every elector/)
    await waitFor(() => expect(screen.getAllByRole('link', { name: '16-584' })[0].getAttribute('title')).toBeNull())
    const inPanel = screen.getAllByRole('link', { name: '16-584' })[0]
    expect(click(inPanel)).toBe(true)
    expect(panel.navigate).toHaveBeenCalledWith('16-584')

    const external = screen.getByRole('link', { name: '16-121.01' })
    expect(external.getAttribute('href')).toBe('https://www.azleg.gov/ars/16/00121-01.htm')
    expect(external.getAttribute('target')).toBe('_blank')
    expect(click(external)).toBe(false)
    expect(panel.navigate).toHaveBeenCalledTimes(1)
  })

  it('leaves modifier clicks on cross-references to the browser', async () => {
    const panel = fakePanel('16-579')
    render(<StatuteViewer panel={panel} />)
    await waitFor(() => expect(screen.getAllByRole('link', { name: '16-584' })[0].getAttribute('title')).toBeNull())
    expect(click(screen.getAllByRole('link', { name: '16-584' })[0], { metaKey: true })).toBe(false)
    expect(panel.navigate).not.toHaveBeenCalled()
  })

  it('does not link years or phone numbers', async () => {
    render(<StatuteViewer panel={fakePanel('16-579')} />)
    await screen.findByText(/Every elector/)
    expect(screen.queryByRole('link', { name: /2025/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /555/ })).toBeNull()
  })

  it('shows a back button only when there is history', async () => {
    const panel = fakePanel('16-584', { canGoBack: true })
    render(<StatuteViewer panel={panel} />)
    await screen.findByText(/not on the register/)
    screen.getByRole('button', { name: /Back/ }).click()
    expect(panel.back).toHaveBeenCalled()
    cleanup()
    render(<StatuteViewer panel={fakePanel('16-584')} />)
    await screen.findByText(/not on the register/)
    expect(screen.queryByRole('button', { name: /Back/ })).toBeNull()
  })

  it('explains a section that is not in the dataset, with an azleg.gov link', async () => {
    render(<StatuteViewer panel={fakePanel('16-100(A)')} />)
    expect(await screen.findByText(/doesn't have the text of A\.R\.S\. § 16-100/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Read it on azleg\.gov/ }).getAttribute('href')).toBe(
      'https://www.azleg.gov/ars/16/00100.htm',
    )
  })

  it('explains a section azleg.gov did not have', async () => {
    render(<StatuteViewer panel={fakePanel('16-999')} />)
    expect(await screen.findByText(/wasn't available from azleg\.gov/)).toBeTruthy()
  })

  it('explains a failed fetch', async () => {
    files['index.json'] = { ...fixtureIndex, sections: { ...fixtureIndex.sections, '16-400': 'Boom' } }
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith('16-400.json')) throw new TypeError('network down')
      return new Response(JSON.stringify(files[String(url).split('/').pop()!]), { status: 200 })
    })
    render(<StatuteViewer panel={fakePanel('16-400')} />)
    expect(await screen.findByText(/Couldn't load A\.R\.S\. § 16-400/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Read it on azleg\.gov/ })).toBeTruthy()
    files['index.json'] = fixtureIndex
  })

  it('close button calls close', async () => {
    const panel = fakePanel('16-579')
    render(<StatuteViewer panel={panel} />)
    screen.getByRole('button', { name: 'Close statute panel' }).click()
    expect(panel.close).toHaveBeenCalled()
  })
})
