import { features } from './features/registry'
import { useHashRoute } from './shared/useHashRoute'

function App() {
  const route = useHashRoute()
  const active = features.find((f) => f.id === route) ?? features[0]

  return (
    <>
      <header>
        <h1><a href="#/">AZ Elections Manual</a></h1>
        <nav>
          {features.map((f) => (
            <a key={f.id} href={`#/${f.id}`} aria-current={f === active ? 'page' : undefined}>
              {f.title}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <active.Component />
      </main>
    </>
  )
}

export default App
