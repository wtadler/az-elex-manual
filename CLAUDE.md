# AZ Elections Manual

An unofficial, browsable companion to the 2025 Arizona Elections Procedures Manual (EPM). It's a static React app (Vite and TypeScript) hosted on GitHub Pages. A team of four builds it in 2 hours.

## Ownership: stay in your folder

| Person | Owns | Don't edit |
|---|---|---|
| A: Platform | `src/App.tsx`, `src/shared/`, `src/features/registry.ts`, `src/features/manual/`, `.github/` | others' features |
| B: Calendar data | `src/data/calendar.json`, `scripts/` | UI files |
| C: Calendar UI | `src/features/calendar/` | `calendar.json` (ask B) |
| D: Ballot guide | `src/features/ballot-guide/` | everything else |

- Need a change in someone else's file? Ask them, or open a small PR and tag them.
- New feature: add a folder under `src/features/` and **one line** in `src/features/registry.ts`.

## Data contracts (in `src/shared/types.ts`)

- `Citation`: `{ epmPage?, statute? }`. `epmPage` is the **printed** page number from the page footer, not the PDF page. Printed page N is PDF page N + 14. `Cite` and `epmPdfUrl()` handle the conversion.
- `CalendarEntry`: one row of the Chapter 15 calendar (printed pages 304–320).
- Changing a contract affects everyone, so agree on it as a team first.

## Rules

- **Every rule shown to a user cites the manual** with `<Cite epmPage={…} statute="…" />`. If you can't find the page, the rule doesn't go in.
- **Footnotes count.** Many exceptions live in footnotes, for example the signature cure deadline and Mobile ID versus Apple or Google Wallet. Read the footnotes on every page you encode.
- **No LLM-generated rules at runtime.** The ballot guide is a hand-coded tree that can be checked branch by branch.
- **Never reword the law into something stricter or looser.** When unsure, quote the manual.
- Use hash routes (`#/calendar`), not path routes, because GitHub Pages has no index.html fallback.
- Don't add a backend. Data lives in JSON or TS files in the repo.

## Source material

- `public/epm.pdf`: the manual, served at `./epm.pdf`. Link to a page with `epmPdfUrl(printedPage)`.
- `source/epm.txt`: text extracted with `pdftotext -layout`. Pages are separated by form feeds (`\f`), so PDF page N is the Nth chunk. Footers read `CHAPTER 9: … 211` (the printed page).
- Chapter 9, Sections IV and VI (voter ID and issuing ballots) is printed pages 205–216.

## Workflow

- `npm run dev` for local development. `npm test` runs Vitest. `npm run build` type-checks and builds.
- Branch, then open a small PR. CI tests and builds it, and posts a preview URL. Merge to `main` deploys.
- Merge often. Small PRs avoid conflicts.
- Tests guard the contracts: `src/data/calendar.test.ts` checks the calendar data, and `src/features/ballot-guide/tree.test.ts` checks the tree. Keep them passing, and add cases as you go.
