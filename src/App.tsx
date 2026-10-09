import { features } from './features/registry'
import { PdfPanelProvider } from './shared/PdfPanelContext'
import { SidePanels } from './shared/SidePanels'
import { StatutePanelProvider } from './shared/StatutePanelContext'
import { usePdfPanel } from './shared/usePdfPanel'
import { useHashRoute } from './shared/useHashRoute'
import { useStatutePanel } from './shared/useStatutePanel'

function Shell() {
  const route = useHashRoute()
  const active = features.find((f) => f.id === route) ?? features[0]
  const pdf = usePdfPanel()
  const pdfOpen = pdf?.isOpen ?? false
  const statuteOpen = useStatutePanel()?.isOpen ?? false
  const sideOpen = pdfOpen || statuteOpen

  return (
    <div className={sideOpen ? 'app has-side' : 'app'}>
      <header>
        <h1><a href="#/">AZ Elections Manual</a></h1>
        <nav>
          {features.map((f) => (
            <a key={f.id} href={`#/${f.id}`} aria-current={f === active ? 'page' : undefined}>
              {f.title}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="header-pdf"
          aria-pressed={pdfOpen}
          onClick={() => (pdfOpen ? pdf?.close() : pdf?.open())}
        >
          PDF
        </button>
      </header>
      <div className="layout">
        <div className="content">
          <main>
            <active.Component />
          </main>
        </div>
        <SidePanels />
      </div>
    </div>
  )
}

function App() {
  return (
    <PdfPanelProvider>
      <StatutePanelProvider>
        <Shell />
      </StatutePanelProvider>
    </PdfPanelProvider>
  )
}

export default App
