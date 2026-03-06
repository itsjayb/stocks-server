# Patterns & Strategies — Endpoints

## Frontend routes

| Path | Description |
|------|-------------|
| `/patterns` | Patterns list page |
| `/pattern/:id` | Single pattern (e.g. `/pattern/head-and-shoulders`) |
| `/strategies` | Strategies list page |
| `/strategy/:id` | Single strategy (e.g. `/strategy/value-investing`) |

## Referral routes (redirect + tracking)

Same content, with source prefix; redirects to path after prefix.

| Path | Redirects to |
|------|--------------|
| `/tw/patterns` | `/patterns` |
| `/tw/pattern/:id` | `/pattern/:id` |
| `/tw/strategies` | `/strategies` |
| `/tw/strategy/:id` | `/strategy/:id` |
| `/ig/patterns` | `/patterns` |
| `/ig/pattern/:id` | `/pattern/:id` |
| `/ig/strategies` | `/strategies` |
| `/ig/strategy/:id` | `/strategy/:id` |
| `/fb/patterns` | `/patterns` |
| `/fb/pattern/:id` | `/pattern/:id` |
| `/fb/strategies` | `/strategies` |
| `/fb/strategy/:id` | `/strategy/:id` |
| `/yt/patterns` | `/patterns` |
| `/yt/pattern/:id` | `/pattern/:id` |
| `/yt/strategies` | `/strategies` |
| `/yt/strategy/:id` | `/strategy/:id` |

*(Replace `tw` with `ig`, `fb`, or `yt` for other sources.)*

## Data

- **Patterns:** static data in `src/data/patterns.ts` (no API).
- **Strategies:** inline in `src/pages/StrategiesPage.tsx` (no API).
- Supabase tables `patterns` and `strategies` exist but are not used by the app for this content.
