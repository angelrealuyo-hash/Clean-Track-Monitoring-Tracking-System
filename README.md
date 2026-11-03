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
npm run test:e2e                  # full workflow in a real browser (temporary database; run on Mon/Wed/Fri)
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

### Driver app (3 tabs: Home, My Route, Profile)

- **Home**: greeting, **Start Route**, **Today's Progress** (collected / total stops, from saved records),
  **Report a Problem** (saved for the office; shown in Admin → Collection Monitoring → Driver Problem Reports),
  **Call the Office** (uses Admin → Settings → *Office Phone for Drivers*; no number is shown until one is entered).
- **My Route**: a progress bar fixed under the header, the map, then **Stops in Order** as a queue. The next stop is
  always on top with **Mark as Collected** (asks for confirmation). Marking a stop records that the route stop was
  done; drivers do **not** record bag counts or resident participation. Stops the driver could not pick up stay in
  "Go Back to These Stops". When the last stop is collected, a short confetti "Route Complete!" plays (once per route;
  only a message with reduced motion). **END MY SHIFT** appears only when every stop is collected (the server also
  refuses earlier) and saves the route as completed with its end time. It is not in Profile.
  If a stop truly cannot be collected, the office can end the route in Admin → Collection Monitoring → **End Route**.

### Collection days

The official collection days are **Monday, Wednesday and Friday only** (`src/data/schedule.js`, used by all three
apps and the server). Admins can change the pickup time of those days, not the days. On other days the driver
cannot start a regular route and residents get no pickup reminder or Pick Up Check; a stop the office records on
another day is saved as a **special** run. Residents are not asked to sort waste by type.

**Holidays & suspended pickups** (Routes & Schedules): the admin can mark a future Monday/Wednesday/Friday as a
holiday or suspension, with a reason. That date then has no regular pickup anywhere (no Start Route, reminder or
Pick Up Check), residents get a message, and the Resident calendar shows it.

**Official Philippine holidays (Resident app only)**: `src/resident/data/phHolidays.js` lists each year's nationwide
regular holidays and special (non-working) days, copied from the presidential proclamations (2025: Proc. 727, 839,
878, 911, 729; 2026: Proc. 1006, 1189, 1264; 2027: Proc. 1427). On those dates residents get no regular pickup,
no pickup reminder and no Pick Up Check (the server refuses answers too), and the calendar shows **!** with the
holiday's name on any weekday. Pickup is never moved to another day. Special *working* days (EDSA anniversary)
and regional days (e.g. NCR-only) are not included. A year without a listed proclamation shows no holidays (the
calendar says so); add the next year's proclamation, plus its Eid'l Fitr / Eid'l Adha proclamations, to that
file. The Admin and Driver apps do not use this list.

**Resident calendar** (Pickup Days): a month calendar with an icon on each pickup day, from saved records:
truck = pickup scheduled; check = the resident said they disposed of their garbage; skip = they answered "not
today"; X = they could not dispose, or a Pick Up Check was sent, the day passed and it was never completed;
! = official holiday or barangay holiday/suspension. Future days are never marked X.

### Admin: Collector's Management, profile, sign-in

**Collector's Management** is one overview of Truck 1 (no truck tabs): a personnel capacity summary, then the
**Morning Shift** (06:00 AM - 02:00 PM) and **Afternoon Shift** (02:00 PM - 10:00 PM) as picture cards. Drivers have a
blue **Driver** badge and crew a green **Crew Member** badge (always with the role name). **Add Collector** adds either
role. Drivers keep their sign-in account and availability; crew members do not sign in (`crew_members`).

Personnel limits (rules in `src/data/personnel.js`, enforced by `server/policy.js` and by database triggers/indexes
from `server/migrations/007_personnel_shifts.sql`):

- Each shift: at most **1 active Driver** and **3 active Crew Members**, so at most 2 Drivers, 6 Crew Members and 8 people.
- **Only active people take a place.** Marking someone Inactive keeps their record and shift but frees the place;
  making them Active again (or moving them to another shift) needs a free place there.
- Editing a name, mobile number, picture or position never re-checks the limit; the person's own place is left out
  when a change is checked.
- The same name cannot be listed twice (blocks double submissions). Role (Driver / Crew Member) is fixed after adding;
  to change it, add the person again with the other role and remove the old record.
- The truck's driver on duty must be an active Morning or Afternoon Shift driver; making them inactive or taking them
  off a shift clears it (refused while a route is in progress).
- Migration 007 kept every existing record and picture: old driver shift text became Morning/Afternoon ("Relief
  Driver" became "not on a shift"), active crew filled Morning then Afternoon by date added, and anyone over the limit
  was moved to **Not on a shift** instead of being deleted. Settings is not in the sidebar: the top-right picture/initials and the bottom-left profile open it.
The admin sign-in page uses two columns (branding and form) and stacks on phones.

### Pictures and photos

Report photos, driver problem photos and profile pictures (admin, drivers, crew, residents) are resized in the
browser, then stored in the `uploads` table. Records keep a reference (`upl:<id>`), and images are served only to
signed-in users allowed to see them (`GET /api/images/:id`: the admin; a resident for their own report and picture;
drivers for their own and their crew's pictures). Replaced or removed pictures are deleted.

### Resident pickup feedback

About an hour before the pickup window on pickup days, residents get an in-app **"Today's Pick Up Check!"** message
(once per day; Settings → Automatic Resident Messages can turn it off). They can answer YES/NO right in the message or
on Home. Answering marks the message read. When every required answer is saved, the check closes by itself
(and stays closed after a refresh); a failed save keeps it open with an error. Home asks: *Are you planning to dispose of your garbage today?* → *Did the garbage truck pass your
location?* → *Were you able to dispose of it?* / *Why not?* Answers are saved step by step in `collection_feedback`
(one row per resident per day; answering again keeps the latest answer). Reasons that need follow-up (truck did not
pass / did not stop / other) also create a resident report, so the office can reply from **Resident Reports**.
Replies are friendly and varied: confetti and a cheerful message only right after a resident confirms they disposed of
their garbage (once per day, never when old answers load), a light joke for "not today", and a kind, non-joking reply
when the truck missed them. **Reports & Analytics → Resident Collection Participation** shows the counts, percentages, reasons and a per-date
comparison for a chosen period. Resident answers are labelled *resident-reported*; only stops the driver (or office)
marked are counted as *driver-confirmed* collection.

Tables added by `server/migrations/003_feedback_and_driver_issues.sql`, `004_crew_members.sql` and
`005_schedule_photos_uploads.sql`, `006_schedule_exceptions.sql` (applied automatically on start; existing data is kept; 005 also sets the
saved schedule to Monday/Wednesday/Friday).

## Known limitations

- GPS is simulated (no device). Arrival estimates are estimates from the simulation.
- Route coordinates are demo points, drawn as straight lines between stops.
- "Call the Office" stays disabled until an admin enters the office number in Settings.
- SMS is not implemented. Email needs an SMTP server (see Configuration).
- `nodemailer` is pinned to 10.1.0; advisories about crafted addresses are fixed in 10.1.4+. CleanTrack only accepts
  plain addresses (letters, digits, `._%+-`), which avoids those cases; upgrade when convenient.
- Single server process with SQLite: right for one barangay, not for city-wide use.
