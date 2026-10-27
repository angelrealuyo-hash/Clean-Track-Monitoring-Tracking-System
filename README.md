# CleanTrack — Garbage Truck Monitoring System

Capstone project for **Barangay Rizal, Taguig City**: one barangay, one garbage truck (to be confirmed with
barangay personnel). Three apps share one server and database:

| App | For | Open |
|---|---|---|
| Admin Website | Barangay office | `/admin` |
| Resident App | Households | `/resident` |
| Driver App | Truck driver | `/driver` |

Residents put **tied garbage bags** out at pickup points; no bins or scanning are required.

> **Demo data.** Stop names ("Demo Stop 1"…), puroks, the weekly schedule, hotline numbers, people and map
> coordinates are placeholders until verified with Barangay Rizal. See `src/data/`.

## Run it

Requires **Node.js 22.5+** (tested with Node 24; uses the built-in `node:sqlite` database, no install needed).

```bash
npm install
npm run dev          # app + API on http://localhost:5173 (database: server/data/cleantrack.db)
```

Production:

```bash
npm run build
npm start            # app + API on http://localhost:3000 (PORT to change)
```

Tests:

```bash
npm test                          # unit + API tests (temporary in-memory database)
npx playwright install chromium   # once, for the browser test
npm run test:e2e                  # full workflow in a real browser (temporary database)
npm run lint
```

### Demo accounts

| App | Sign in | Password |
|---|---|---|
| Admin | admin@cleantrack.gov | SuperAdmin#2025 (or **Auto Fill**) |
| Resident | maria.santos@email.com or 0917 555 0192 | resident123 (or **Try the demo**) |
| Driver | driver.ortiz@cleantrack.ph | driver123 (or **Try the demo**) |

Change these passwords (Settings → My Account / Profile → Change Password) before any real use.

## Configuration (optional)

Copy `.env.example` to `.env`. Nothing is required for the demo.

| Variable | Purpose |
|---|---|
| `PORT` | Port for `npm start` (default 3000) |
| `DB_PATH` | SQLite file (default `server/data/cleantrack.db`) |
| `CLEANTRACK_SECRET` | Secret for sign-in tokens (otherwise generated and stored in the database) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email sending. **Without `SMTP_HOST` and `MAIL_FROM`, emails are logged as "not configured" and are not sent.** |
| `CLEANTRACK_TICK_MS` | How often automatic notifications run (default 15000 ms) |

## How it works

- **Server** (`server/`): Express API + SQLite. Tables are created by `server/migrations/001_init.sql`.
  Existing data is never reset automatically (only **Settings → Reset Demo Data**, with confirmation).
- **Sign-in**: passwords hashed with scrypt; signed tokens that expire after 7 days; disabled accounts are refused.
- **Permissions & validation**: `server/policy.js` checks every action on the server (who may do it, valid input,
  conflicts such as changing the driver during a route). Residents only receive their own reports and profile.
- **Shared data**: every app reads the same records; open screens update live (Server-Sent Events).
- **Collection records**: Start Route saves a collection run; each pickup point is recorded by the driver
  (or office) with time, recorder and bags. "Missed" needs a reason; "not yet visited" stays separate.
- **Simulated GPS** (`src/services/trackingSimulation.js`): the truck follows the route's fixed points, waits at each
  pickup point until it is recorded, and is labelled **SIMULATED GPS — DEMO MODE** everywhere. Position is calculated
  from saved controls + clock, so all screens agree. Key positions are saved in `location_history` (source `SIMULATED`).
- **Notifications** (in-app, per-person read state): report updates, broadcasts, a daily pickup reminder, and
  "truck is coming" when the **simulated** truck heads to the first pickup point of a purok (once per route run).
  Matching emails go to residents who gave an email and allow email; every attempt is in **Notifications → Email Log**.

## Known limitations

- GPS is simulated (no device). Arrival estimates are estimates from the simulation.
- Route coordinates are demo points, drawn as straight lines between stops.
- SMS is not implemented. Email needs an SMTP server (see Configuration).
- `nodemailer` is pinned to 10.1.0; advisories about crafted addresses are fixed in 10.1.4+. CleanTrack only accepts
  plain addresses (letters, digits, `._%+-`), which avoids those cases; upgrade when convenient.
- Single server process with SQLite: right for one barangay, not for city-wide use.
