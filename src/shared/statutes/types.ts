// Data contract for the statute panel. Files live in public/statutes/ and are fetched at runtime.

/** public/statutes/index.json: which sections the site has, and which ones couldn't be fetched. */
export interface StatuteIndex {
  /** Date the texts were retrieved from azleg.gov, "YYYY-MM-DD". */
  retrieved: string
  /** Where the texts came from, e.g. "https://www.azleg.gov/ars/". */
  source: string
  /** Section id ("16-579", "16-121.01", "9-471") -> section title. */
  sections: Record<string, string>
  /** Section id -> why it's missing (e.g. "404"). */
  missing?: Record<string, string>
}

/** public/statutes/<id>.json: one section's current text. */
export interface StatuteDoc {
  id: string
  title: string
  /** azleg.gov page the text came from. */
  url: string
  /** "YYYY-MM-DD". */
  retrieved: string
  /** Editorial notes from azleg.gov, e.g. "(Caution: 1998 Prop. 105 applies)". */
  notes: string[]
  /** Paragraphs in order, each starting with its label: "A. ...", "1. ...", "(a) ...". */
  paragraphs: string[]
}
