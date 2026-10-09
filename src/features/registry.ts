import type { ComponentType } from 'react'
import { BallotGuidePage } from './ballot-guide/BallotGuidePage'
import { CalendarPage } from './calendar/CalendarPage'
import { Home } from './home/Home'
import { ManualPage } from './manual/ManualPage'

export interface Feature {
  /** URL hash: #/<id>. Empty string is the home page. */
  id: string
  title: string
  Component: ComponentType
}

// One line per tab. To add a feature, add a folder under src/features/ and one line here.
export const features: Feature[] = [
  { id: '', title: 'Home', Component: Home },
  { id: 'calendar', title: 'Calendar', Component: CalendarPage },
  { id: 'ballot-guide', title: 'Ballot guide', Component: BallotGuidePage },
  { id: 'manual', title: 'Manual', Component: ManualPage },
]
