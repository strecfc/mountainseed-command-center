# MountainSeed Leadership Command Center

Private dashboard for MountainSeed leadership. It shows whether the company is on track for its 2027 goals: revenue run rate, gross margin, EBITDA, new sales, upsell, M&A, churn, and operations. Carl Streck's admin account is the only way in. There is no public sign-up.

The repository should stay private. `data/seed` contains the real 3 Nov 2026 leadership Scorecard and the 27 Oct 2026 MarketPlace Sales Scorecard. Tiles without a source say **Awaiting data**. Nothing in the seed is estimated.

## Stack

- Next.js (App Router) and React
- Postgres. Local dev and tests use embedded Postgres ([PGlite](https://pglite.dev)) so you can run without installing a database. Production should use managed Postgres.
- Argon2id password hashes, HTTP-only session cookies, login rate limits
- ExcelJS for scorecard, Augur, and budget workbooks

## Environment

Copy `.env.example` to `.env.local`. Never commit real passwords, Salesforce secrets, or ingest tokens.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Managed Postgres connection string. Leave empty locally to use embedded Postgres. |
| `DATABASE_SSL` | Set to `require` on Railway, Render, and similar hosts. |
| `PGLITE_DIR` | Folder for the local embedded database. Default `data/pglite`. |
| `ADMIN_EMAIL` | First admin. Defaults to `Carl@mountainseed.com` only when unset. |
| `ADMIN_PASSWORD` | Required to create that admin. Minimum 10 characters. Not hard-coded. If the email already exists, the password is left alone. |
| `ADMIN_NAME` | Display name. Defaults to Carl Streck. |
| `APP_BASE_URL` | Public origin used in invite links, for example `https://command.example.com`. |
| `SESSION_HOURS` | Session lifetime. Default 18. |
| `COOKIE_SECURE` | Leave unset to follow https or `x-forwarded-proto`. Set `true` if the proxy terminates TLS without that header. |
| `CRON_SECRET` | Bearer token for `POST /api/cron/daily`. |
| `ENABLE_DAILY_JOB` | `true` on a long-running host so the in-process scheduler runs. `false` on Vercel. |
| `DAILY_JOB_UTC_HOUR` | UTC hour for the daily Salesforce pull. `11` is 6:00 AM US Eastern standard time. |
| `SF_LOGIN_URL` | Usually `https://login.salesforce.com`. |
| `SF_CLIENT_ID` / `SF_CLIENT_SECRET` | Connected-app credentials. |
| `SF_USERNAME` / `SF_PASSWORD` / `SF_SECURITY_TOKEN` | User used for the daily SOQL pull. The token is appended to the password. |
| `SF_SOQL_JSON` | Optional JSON object of query name to SOQL, overriding the built-in queries. |

If the Salesforce variables are empty, every Salesforce tile says **Not connected** and the app does not call Salesforce.

## Run locally

```bash
npm install
# set ADMIN_PASSWORD in .env.local
npm run dev
```

Open `http://localhost:3000`, sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

```bash
npm test
npm run typecheck
npm run build
npm start
```

## How Carl adds people

1. Sign in as an admin.
2. Open **Admin → People**.
3. Enter a name, email, and role (`admin` or `viewer`).
4. Either set a temporary password (they should change it) or check **Generate an invite link**. The link is shown once and expires in 72 hours. It opens `/set-password`.
5. Disable, reset, or delete accounts from the same table. The last active admin cannot be removed.

Viewers can read the scoreboard. They cannot upload, edit notes, change targets, or manage accounts.

## Weekly scorecard

Max DiPlotti's leadership Scorecard is the weekly source.

- **Admin → Uploads** accepts `.xlsx`, `.csv`, or a paste of the email body (`=== MarketPlace ===` and the pipe-separated rows).
- Or enter one week in the form. Existing weeks are updated; older weeks stay, so trends keep their history.
- Each tile shows the value, the goal, this week, the trailing four scorecard weeks, quarter-to-date pace, the last updated time, and the source.

The seeded week ending is **25 Oct 2026**, from the Scorecard received **3 Nov 2026, 4:22 PM ET**.

## Monthly budget vs actual

September 2026 is already loaded from Max DiPlotti’s 16 Oct 2026 email (`data/seed/finance_bva_2026-09.json`, workbook `data/seed/LT_BvA_Sep2026.xlsx`). The Finance tab shows September and year-to-date actual versus budget, the FY 2026 budget, the Jan–Sep trend, and the revenue lines. EBITDA on that tab is **reported EBITDA**. The workbook has no adjusted EBITDA line.

Year-to-date budget is Q1 + Q2 + Q3 from the P&L. It is not the full-year budget. April–June monthly operating expense and EBITDA on the chart come from the Q2 tab; the Q2 total used for that quarter is the later P&L column, because the Q2 tab’s G&A staff does not match.

To load the next month:

1. Sign in as an admin and open **Admin → Uploads**.
2. Under **Monthly budget vs actual**, choose either the `.xlsx` workbook or a `.json` file in the same shape as `data/seed/finance_bva_2026-09.json` (`period_end`, `september`, `ytd`, `quarters`, `full_year_budget`, `monthly`).
3. The new `period_end` becomes the latest snapshot. September stays in the database.

Or push the JSON with the ingest token. `snapshot` is the file itself:

```bash
jq -n --slurpfile snapshot data/seed/finance_bva_2026-09.json \
  '{dataset:"budget_vs_actual", snapshot:$snapshot[0]}' \
| curl -X POST "$APP_BASE_URL/api/ingest" \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d @-
```

A plain `.xlsx` still works for a simpler Actual/Budget sheet. Row labels for that parser are edited under **Budget parser mapping**.

The scoreboard keeps the weekly scorecard gross margin and adds the BvA year-to-date gross margin with its as-of date. Reported EBITDA margin uses the BvA year-to-date figure against the BvA budget. Long Ridge’s 35% target stays a labeled reference line.

## Orders (ValuTrac)

Upload a CSV with columns such as client, completed date, appraiser type (`CRA` or `fee`), fee, cost, turn time, revision, and product. The latest upload replaces the order lines. That is what fills:

- CRA versus fee files, share, average fee, cost, margin, turn time, and revision rate
- clients with a second product, when a product column is present
- repeat paid orders
- early-warning drops: latest 7 days versus that client's prior 90-day weekly baseline, flagged above a 20% drop

Until that file exists, the operations page shows the scorecard's **QCR Volume** and **CRR Volume (Team Leads and CRA's)** only.

## Ingest API

Create a token under **Admin → Ingest API**. It is shown once and stored only as a hash.

```bash
curl -X POST "$APP_BASE_URL/api/ingest" \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": "weekly_scorecard",
    "source": "wednesday-bot",
    "text": "=== MarketPlace ===\nRevenue | Gross Margin (Blended) | 68.1% | | 69.5% | 98% | 69.5% | 68%"
  }'
```

`dataset` is one of `weekly_scorecard`, `monthly_financials`, `budget_vs_actual`, `notes`, `orders`, or `at_risk`.

- `weekly_scorecard` takes `text` (email or CSV) or `rows` of `{ label, weekEnding, value, totalQtd, avgQtd, qtdGoal, wkGoal, section, category }`.
- `budget_vs_actual` takes `snapshot`, the September-style JSON (`period_end`, `september`, `ytd`, `quarters`, `monthly`).
- `monthly_financials` takes `financials` with `period` (`YYYY-MM-01`) and the actual/budget numbers. Use this for a single month, not for the full BvA package.
- `notes` takes `weekEnding` plus `note.whatChanged`, `note.owner`, and `note.nextStep`.
- `orders` takes CSV in `text`.
- `at_risk` takes `rows` of `{ clientName, tier, reason, annualValue }`.

A missing or revoked token returns 401. The same is true for every page and API route without a session. `/api/cron/daily` is the other machine route: `Authorization: Bearer $CRON_SECRET`.

## Deploy

Use a host with managed Postgres. Railway or Render fit a long-running Node server and the in-process daily job. Vercel works for the web app if you set `ENABLE_DAILY_JOB=false` and call the cron route from Vercel Cron.

1. Create a Postgres database and set `DATABASE_URL` (and `DATABASE_SSL=require` if the host requires TLS).
2. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_BASE_URL`, and `CRON_SECRET`.
3. Build with `npm run build` and start with `npm start` (`output: "standalone"` is enabled for container hosts).
4. Sign in, change anything you do not want left on the seeded admin, and add the rest of the leadership team.
5. Add Salesforce credentials when the connected app is ready. Use **Admin → Sync now** or wait for the daily job. Map SOQL to your org with `SF_SOQL_JSON` if the default objects do not match. The default pull asks for open pipeline, year-to-date wins, new accounts, open existing-business opportunities, M&A opportunities by stage, and open churn-risk cases. A failed query is stored on that snapshot and does not block the others.

Seed data is loaded once, the first time the database is empty. Later uploads are not overwritten by the seed.

## Tests

`npm test` covers:

- The scorecard parser against every row of the 3 Nov 2026 email
- Marketplace sales notes, the Augur workbook, a budget workbook, and a ValuTrac-style CSV
- Unauthenticated access on every page (redirect to `/login`) and every API handler (401), including a forged session cookie
- Admin sign-in, the seeded gross-margin and churn figures, viewer denial, and the ingest token
