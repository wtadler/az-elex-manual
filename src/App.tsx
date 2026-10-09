import { features } from './features/registry'
import { PdfPanel } from './shared/PdfPanel'
import { PdfPanelProvider } from './shared/PdfPanelContext'
import { usePdfPanel } from './shared/usePdfPanel'
import { useHashRoute } from './shared/useHashRoute'

function Shell() {
  const route = useHashRoute()
  const active = features.find((f) => f.id === route) ?? features[0]
  const pdf = usePdfPanel()
  const pdfOpen = pdf?.isOpen ?? false

  return (
    <div className={pdfOpen ? 'app has-pdf' : 'app'}>
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
        <PdfPanel />
      </div>
    </div>
  )
}

function App() {
  return (
    <PdfPanelProvider>
      <Shell />
    </PdfPanelProvider>
  )
}

export default App
