# Focus Journal

A calm daily focus journal. Set one intention, run focus timers, tick off a short task list, and watch your week and the last 12 weeks take shape in animated d3 charts.

- **Intention + tasks** for today, with a streak that counts days where you focused or finished something.
- **Focus timer** (15 / 25 / 50 min) with a sweeping ring and a small celebration when a session is logged.
- **Animated d3 visuals:** a 7-day bar chart with trend line, and a 12-week activity heatmap. Respects `prefers-reduced-motion`.
- **Daily focus goal** with a progress bar, **carry-over** of yesterday's unfinished tasks, a **weekly review** in plain language, and a **Space** shortcut plus a soft chime for the timer.
- **Light and dark themes**, mobile friendly.
- **Your data, two ways:**
  - *Static mode:* stays in your browser's local storage. Works on GitHub Pages or any file host. Export and import as JSON.
  - *PostgreSQL mode:* run the bundled Node server and days sync to a Postgres table. Local storage stays as a fallback.

## Run it

Static, no database (needs any static file server because the app uses ES modules):

```sh
npm run static   # http://localhost:8000
```

With PostgreSQL via Docker:

```sh
docker compose up --build   # http://localhost:8000
```

With your own Postgres:

```sh
npm ci
DATABASE_URL=postgres://user:pass@localhost:5432/focus npm start
```

The server creates the `days` table on start (`server/schema.sql`).

## Test

```sh
npm test                                   # store logic (API test is skipped without a DB)
TEST_DATABASE_URL=postgres://... npm test  # also runs the API test against Postgres
```

## How it is built

| Path | Purpose |
| --- | --- |
| `js/store.js` | Pure, tested data logic (days, tasks, streaks, import/export validation) |
| `js/app.js` | UI wiring, timer, rendering |
| `js/viz.js` | d3 charts and animations |
| `js/sync.js` | Optional API sync with graceful fallback |
| `server/` | Small Node HTTP server + `pg`; `GET /api/health`, `GET /api/days`, `PUT /api/days/:date` |
| `vendor/d3.min.js` | d3 v7.9.0 (ISC licence), vendored so the app works offline |

## Notes and limits

- The API has no authentication, so it is meant for personal or trusted-network use. Add auth before exposing it publicly.
- Sync is last-write-wins per day; the server's copy wins when the page loads.
- Deployment: `.github/workflows/pages.yml` tests every PR and deploys the static app to GitHub Pages from `main` (enable Pages with source "GitHub Actions" in repo settings). Pages is static-only, so PostgreSQL mode needs the server hosted elsewhere.
