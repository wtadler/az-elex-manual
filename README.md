# AZ Elections Manual

An unofficial, easier-to-use companion to the [2025 Arizona Elections Procedures Manual](https://apps.azsos.gov/election/files/epm/2025/Election-Procedures-Manual-2025--FINAL-12-22-25.pdf) (EPM), published by the Arizona Secretary of State. Every rule links back to its page in the manual and to the statute.

**This is not an official Secretary of State product. The manual is the authority.**

## Features

- **Calendar:** Chapter 15's election calendar, filterable by election and office
- **Ballot guide:** which ballot a voter gets at check-in (Chapter 9)
- **Manual:** browse and search the EPM

## Develop

```bash
npm ci
npm run dev
```

`npm test` runs the tests. `npm run build` builds to `dist/`.

## Deploy

- Merging to `main` publishes to GitHub Pages at https://azunofficialelectionsmanual.com through `.github/workflows/deploy.yml`. `public/CNAME` keeps the custom domain across deploys.
- Each pull request gets a preview at `/pr-preview/pr-<number>/` through `.github/workflows/preview.yml`.

See [CLAUDE.md](CLAUDE.md) for team roles, data contracts, and rules.
