import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PanelLink } from '../PanelLink'
import type { StatutePanelApi } from '../useStatutePanel'
import { linkifySections } from './crossRefs'
import { formatRetrieved } from './format'
import { loadStatute, loadStatuteIndex, StatuteNotFound } from './load'
import { findSubsection, paragraphLevels } from './paragraphs'
import { azlegUrl, parseStatuteRef } from './ref'
import type { StatuteDoc, StatuteIndex } from './types'

type DocResult = { id: string; doc: StatuteDoc } | { id: string; error: 'missing' | 'failed' }

/** Statute text with clickable cross-references. Sections the site has open in the panel. */
function StatuteText({ text, index, onOpen }: { text: string; index: StatuteIndex | null; onOpen: (id: string) => void }) {
  return (
    <>
      {linkifySections(text).map((part, i) => {
        if (part.id == null) return part.text
        const inPanel = index?.sections[part.id] != null
        return (
          <PanelLink
            key={i}
            href={azlegUrl(part.id)}
            title={inPanel ? undefined : 'Opens azleg.gov in a new tab'}
            onOpen={inPanel ? () => onOpen(part.id) : undefined}
          >
            {part.text}
          </PanelLink>
        )
      })}
    </>
  )
}

/** The statute panel's contents: header, notes, paragraphs with the cited subsection highlighted. */
export default function StatuteViewer({ panel }: { panel: StatutePanelApi }) {
  const shown = panel.current
  const ref = useMemo(() => (shown ? parseStatuteRef(shown) : null), [shown])
  const id = ref?.id ?? ''
  const [index, setIndex] = useState<StatuteIndex | null>(null)
  const [result, setResult] = useState<DocResult | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadStatuteIndex().then(
      (i) => alive && setIndex(i),
      () => {}, // without the index, cross-references just open azleg.gov
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!id) return
    let alive = true
    loadStatute(id).then(
      (doc) => alive && setResult({ id, doc }),
      (err: unknown) => alive && setResult({ id, error: err instanceof StatuteNotFound ? 'missing' : 'failed' }),
    )
    return () => {
      alive = false
    }
  }, [id])

  const current = result?.id === id ? result : null
  const doc = current && 'doc' in current ? current.doc : null
  const infos = useMemo(() => (doc ? paragraphLevels(doc.paragraphs) : []), [doc])
  const target = doc && ref ? findSubsection(infos, ref.path) : null

  // Scroll the cited subsection into view on every open (nonce), or to the top if there isn't one.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || !doc) return
    const p = target == null ? null : el.querySelector<HTMLElement>(`[data-p="${target}"]`)
    el.scrollTop = p ? Math.max(0, p.offsetTop - 8) : 0
  }, [doc, target, panel.nonce])

  const title = doc?.title ?? index?.sections[id]
  const url = doc?.url ?? azlegUrl(id)
  const retrieved = doc?.retrieved ?? index?.retrieved
  const notInDataset = index != null && index.sections[id] == null
  const missingReason = index?.missing?.[id]

  let body
  if (doc) {
    body = (
      <>
        {doc.notes.map((n, i) => (
          <p key={i} className="statute-note">
            {n}
          </p>
        ))}
        {doc.paragraphs.map((text, i) => (
          <p
            key={i}
            data-p={i}
            className={`statute-p statute-level-${infos[i]?.level ?? 0}${i === target ? ' is-target' : ''}`}
            aria-current={i === target ? 'true' : undefined}
          >
            <StatuteText text={text} index={index} onOpen={panel.navigate} />
          </p>
        ))}
      </>
    )
  } else if (notInDataset || current) {
    body = (
      <p className="statute-status">
        {notInDataset && missingReason == null
          ? `This site doesn't have the text of A.R.S. § ${id}.`
          : missingReason != null || (current && 'error' in current && current.error === 'missing')
            ? `The text of A.R.S. § ${id} wasn't available from azleg.gov when this site's copies were made.`
            : `Couldn't load A.R.S. § ${id}.`}{' '}
        <a href={url} target="_blank" rel="noreferrer">
          Read it on azleg.gov ↗
        </a>
      </p>
    )
  } else {
    body = <p className="statute-status">Loading A.R.S. § {id}…</p>
  }

  return (
    <div className="statute-viewer">
      <div className="statute-toolbar">
        {panel.canGoBack && (
          <button type="button" onClick={panel.back} aria-label="Back to the previous statute">
            ‹ Back
          </button>
        )}
        <h2 className="statute-heading">A.R.S. §&nbsp;{id}</h2>
        <button type="button" className="pdf-close" onClick={panel.close} aria-label="Close statute panel">
          ✕<span className="pdf-close-label"> Close</span>
        </button>
        {title && <p className="statute-title">{title}</p>}
        <a className="statute-azleg" href={url} target="_blank" rel="noreferrer">
          Open on azleg.gov ↗
        </a>
      </div>
      <div ref={scroller} className="statute-scroller">
        <div className="statute-body">
          {body}
          {doc && retrieved && (
            <p className="statute-source">
              Current text from azleg.gov, retrieved {formatRetrieved(retrieved)}. The law may have changed since the
              2025 manual was written. This is an unofficial copy; azleg.gov has the current version.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
