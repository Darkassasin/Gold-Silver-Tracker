# Gold & Silver Rate Tracker (Nepal)

A dashboard of gold and silver rates **per tola** from the FENEGOSIDA API, with a 15-day trend chart and daily history table.

## Run

Requires Node 18+. No dependencies to install.

```bash
npm start
# open http://localhost:3000
```

## How it works

- `GET /Dashboard/today` gives the latest tola rates and the previous rate, which feed the two cards.
- For history, the app builds the 15 dates before today (Nepal time, `YYYY-MM-DD`) and calls
  `GET /Dashboard/datewisehistory?date=<date>` for each one in parallel.
- Each past day is cached in `localStorage` after its first successful fetch, so reloads are fast.
- Days with no published rate (holidays, gaps) show as "No rate" and the chart skips them.
- The browser calls the API directly first. If it is blocked by CORS, it retries through
  `/proxy/*` on the local server (`server.js`).

## If history looks empty

The history response shape is parsed in `tolaRate()` in `public/app.js`. It expects the same
fields as `/today` (`rateType` containing the tola label, and `todayBaseRatePerGram`). Open the
browser's Network tab, check one `datewisehistory` response, and adjust `rows()` / `tolaRate()`
if the field names differ.

## Files

- `public/index.html`, `public/styles.css`, `public/app.js`: the dashboard
- `server.js`: static server and API proxy
# Gold-Silver-Tracker
