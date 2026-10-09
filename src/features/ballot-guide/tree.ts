import type { Citation } from '../../shared/types'

// Ballot-type decision tree for Chapter 9, Sections IV and VI (printed pages 205–216).
// Owner: Person D. Hand-coded, not LLM-generated: every branch must be checkable against the manual.

export type BallotType = 'regular' | 'conditional-provisional' | 'provisional' | 'redirect'

export interface QuestionNode {
  kind: 'question'
  id: string
  text: string
  /** Optional clarification shown under the question (footnote exceptions go here). */
  help?: string
  cites: Citation[]
  options: { label: string; next: string }[]
}

export interface OutcomeNode {
  kind: 'outcome'
  id: string
  ballot: BallotType
  text: string
  cites: Citation[]
}

export type GuideNode = QuestionNode | OutcomeNode

export const START = 'on-roster'

// SAMPLE: covers only the roster check and List 1 / tribal ID. List 2, List 3, early ballot,
// inactive, name change, moved, out-of-precinct, and federal-only branches are still to do.
export const nodes: GuideNode[] = [
  {
    kind: 'question',
    id: 'on-roster',
    text: 'Does the voter appear in the signature roster or e-pollbook?',
    cites: [{ epmPage: 212, statute: '16-584' }],
    options: [
      { label: 'Yes', next: 'list-1' },
      { label: 'No', next: 'not-on-roster' },
    ],
  },
  {
    kind: 'question',
    id: 'list-1',
    text: 'Does the voter show one List 1 photo ID whose name and address reasonably match the roster?',
    help: 'Includes an AZMVD-issued Arizona Mobile ID, but not Google Wallet or Apple Wallet. A public university ID counts only if it shows photo, name, and address.',
    cites: [{ epmPage: 206, statute: '16-579(A)(1)(a)' }],
    options: [
      { label: 'Yes', next: 'regular' },
      { label: 'No', next: 'tribal-id' },
    ],
  },
  {
    kind: 'question',
    id: 'tribal-id',
    text: 'Does the voter identify as a member of a federally recognized tribe and show one item of tribal identification?',
    cites: [{ epmPage: 208, statute: '16-579(A)(1)' }],
    options: [
      { label: 'Yes', next: 'provisional-tribal' },
      { label: 'No', next: 'conditional-provisional' },
    ],
  },
  {
    kind: 'outcome',
    id: 'regular',
    ballot: 'regular',
    text: 'Issue a regular ballot.',
    cites: [{ epmPage: 210 }],
  },
  {
    kind: 'outcome',
    id: 'provisional-tribal',
    ballot: 'provisional',
    text: 'Issue a provisional ballot (not a conditional provisional). The voter does not need to return to confirm identity.',
    cites: [{ epmPage: 208, statute: '16-579(A)(1)' }],
  },
  {
    kind: 'outcome',
    id: 'conditional-provisional',
    ballot: 'conditional-provisional',
    text: 'TODO (sample stops here): check List 2 and List 3 before issuing a conditional provisional ballot.',
    cites: [{ epmPage: 208, statute: '16-579(A)(2)' }],
  },
  {
    kind: 'outcome',
    id: 'not-on-roster',
    ballot: 'provisional',
    text: 'Issue a provisional ballot if the voter shows ID with an address in the precinct (or county, for vote centers), or signs an affirmation that they are registered and eligible. A Recorder’s Certificate entitles the voter to a regular ballot instead.',
    cites: [{ epmPage: 212, statute: '16-584(A)' }, { statute: '16-584(B)' }],
  },
]

export const byId = new Map(nodes.map((n) => [n.id, n]))
