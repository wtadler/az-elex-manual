// Invented statute text for tests. The shape matches public/statutes/*.json; the words don't.

import type { StatuteDoc, StatuteIndex } from './types'

export const fixtureIndex: StatuteIndex = {
  retrieved: '2026-10-01',
  source: 'https://www.azleg.gov/ars/',
  sections: {
    '16-579': 'Procedure for obtaining ballot by elector',
    '16-584': 'Qualified elector not on precinct register',
  },
  missing: { '16-999': '404' },
}

export const fixture16579: StatuteDoc = {
  id: '16-579',
  title: 'Procedure for obtaining ballot by elector',
  url: 'https://www.azleg.gov/ars/16/00579.htm',
  retrieved: '2026-10-01',
  notes: ['(Caution:  1998 Prop. 105 applies)'],
  paragraphs: [
    'A. Every elector shall announce a name and address to the election board.',
    '1. The elector shall show one of the following:',
    '(a) A card with a photo, name, and address.',
    '(b) Two papers with a name and address.',
    '2. An elector who shows nothing may vote as described in section 16-584.',
    'B. Before 2025-2026, call 602-555-0100 or see sections 16-584 and 16-121.01.',
    '1. A repeated label under B.',
  ],
}

export const fixture16584: StatuteDoc = {
  id: '16-584',
  title: 'Qualified elector not on precinct register',
  url: 'https://www.azleg.gov/ars/16/00584.htm',
  retrieved: '2026-10-01',
  notes: [],
  paragraphs: ['A. An elector who is not on the register may vote a provisional ballot.', 'B. See section 16-579.'],
}
