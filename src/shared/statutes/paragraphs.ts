// Structure of a statute's paragraphs: "A." is level 1, "1." level 2, "(a)" level 3, "(i)" level 4.

export interface ParagraphInfo {
  /** Label without punctuation ("A", "1", "a", "ii"), or null for an unlabeled paragraph. */
  label: string | null
  /** 1–4 by label type; 0 for unlabeled paragraphs (shown without indent). */
  level: number
}

const ROMAN = /^(?=[ivx]+$)x{0,3}(ix|iv|v?i{0,3})$/

function isRoman(label: string): boolean {
  return ROMAN.test(label)
}

function nextLetter(letter: string): string {
  return String.fromCharCode(letter.charCodeAt(0) + 1)
}

/**
 * Level of one subsection label given the level of the label before it. Capital letter: 1;
 * number: 2; lowercase: 3, except a roman numeral (i, ii, iv…) right under a level-3 or deeper
 * item, which is 4. Returns 0 for anything else.
 */
export function segmentLevel(label: string, prevLevel: number): number {
  if (/^[A-Z]$/.test(label)) return 1
  if (/^\d{1,3}$/.test(label)) return 2
  if (/^[a-z]{1,4}$/.test(label)) return isRoman(label) && prevLevel >= 3 ? 4 : 3
  return 0
}

const LABEL = /^\s*(?:([A-Z])\.|(\d{1,3})\.|\(([a-z]{1,4})\))\s/

/** The leading label of a paragraph ("A. Every…" -> "A"), or null. */
export function paragraphLabel(text: string): string | null {
  const m = text.match(LABEL)
  return m ? (m[1] ?? m[2] ?? m[3]) : null
}

/**
 * Labels and levels for a section's paragraphs, in order. Lowercase labels are ambiguous: "(i)" is
 * the letter after "(h)" but also roman one. A roman-looking label counts as a letter when it's
 * the next letter in the current lettered list (or there's no list yet), and as level 4 otherwise.
 */
export function paragraphLevels(paragraphs: string[]): ParagraphInfo[] {
  let prevLevel = 0
  let lastLetter: string | null = null
  return paragraphs.map((text) => {
    const label = paragraphLabel(text)
    if (label == null) return { label: null, level: 0 }
    let level: number
    if (/^[a-z]+$/.test(label)) {
      const continuesLetters = label.length === 1 && lastLetter != null && label === nextLetter(lastLetter)
      if (isRoman(label) && !continuesLetters && prevLevel >= 3) level = 4
      else {
        level = 3
        if (label.length === 1) lastLetter = label
      }
    } else {
      level = segmentLevel(label, prevLevel)
      lastLetter = null
    }
    prevLevel = level
    return { label, level }
  })
}

/**
 * Index of the paragraph a subsection path points to, e.g. ["A", "1", "a"]: the "A." paragraph,
 * then the first "1." inside it, then the first "(a)" inside that. Each step searches only within
 * the parent subsection, so a "1." under B isn't taken for one under A. Returns the deepest match,
 * or null if the first label isn't found (or the path is empty).
 */
export function findSubsection(infos: ParagraphInfo[], path: string[]): number | null {
  let found: number | null = null
  let start = 0
  let parentLevel = 0
  for (const label of path) {
    const want = segmentLevel(label, parentLevel)
    let hit: number | null = null
    for (let i = start; i < infos.length; i++) {
      const info = infos[i]
      if (info.label == null) continue
      if (info.level <= parentLevel) break // left the parent subsection
      if (info.label === label && info.level === want) {
        hit = i
        break
      }
    }
    if (hit == null) break
    found = hit
    start = hit + 1
    parentLevel = infos[hit].level
  }
  return found
}
