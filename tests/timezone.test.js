// Step 0: every "today", weekday and clock time is Philippine time
// (Asia/Manila, UTC+08:00), whatever time zone the machine uses.
// Run with: npm test
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { openDatabase } from '../server/db.js'
import { createApi } from '../server/app.js'
import { daysAgoISO, formatDate, manilaDateISO, manilaMoment, manilaParts, todayISO, todayName } from '../src/utils/format.js'

// Instants written in UTC, with the Manila time they stand for.
const AT = {
  wed0430: Date.parse('2026-12-01T20:30:00Z'), // Wed 2 Dec 2026, 04:30 Manila (still Tuesday in UTC)
  wed2030: Date.parse('2026-12-02T12:30:00Z'), // Wed 2 Dec 2026, 20:30 Manila
  thu0430: Date.parse('2026-12-02T20:30:00Z'), // Thu 3 Dec 2026, 04:30 Manila (still Wednesday in UTC)
  wed2359: Date.parse('2026-12-02T15:59:00Z'), // Wed 2 Dec 2026, 23:59 Manila
  thu0000: Date.parse('2026-12-02T16:00:00Z'), // Thu 3 Dec 2026, 00:00 Manila
}

// Runs fn with the process set to another time zone (Node applies TZ changes at once).
function inZone(tz, fn) {
  const saved = process.env.TZ
  process.env.TZ = tz
  try {
    return fn()
  } finally {
    if (saved === undefined) delete process.env.TZ
    else process.env.TZ = saved
  }
}
const ZONES = ['UTC', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Asia/Manila']

test('the machine time zone really changes in these tests (sanity check)', () => {
  const hourIn = (tz) => inZone(tz, () => new Date(AT.wed0430).getHours())
  assert.equal(hourIn('UTC'), 20)
  assert.equal(hourIn('Asia/Manila'), 4)
  assert.notEqual(hourIn('America/Los_Angeles'), hourIn('UTC'))
})

test('4:30 AM Manila is that Manila date, in every machine time zone', () => {
  for (const tz of ZONES)
    inZone(tz, () => {
      assert.equal(todayISO(AT.wed0430), '2026-12-02', tz)
      assert.equal(todayName(AT.wed0430), 'Wednesday', tz)
      assert.deepEqual(manilaParts(AT.wed0430), { iso: '2026-12-02', weekday: 'Wednesday', hour: 4, minute: 30 }, tz)
      assert.equal(todayISO(AT.thu0430), '2026-12-03', tz)
      assert.equal(todayName(AT.thu0430), 'Thursday', tz)
    })
})

test('8:30 PM Manila is that Manila date and time', () => {
  for (const tz of ZONES)
    inZone(tz, () => {
      assert.deepEqual(manilaParts(AT.wed2030), { iso: '2026-12-02', weekday: 'Wednesday', hour: 20, minute: 30 }, tz)
    })
})

test('the date changes at Manila midnight, not UTC midnight', () => {
  for (const tz of ZONES)
    inZone(tz, () => {
      assert.equal(todayISO(AT.wed2359), '2026-12-02', tz)
      assert.equal(todayName(AT.wed2359), 'Wednesday', tz)
      assert.equal(todayISO(AT.thu0000), '2026-12-03', tz)
      assert.equal(todayName(AT.thu0000), 'Thursday', tz)
    })
})

test('Manila weekday for a whole week at 04:30 and 20:30', () => {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  for (let i = 0; i < 7; i++) {
    const date = `2026-12-${String(7 + i).padStart(2, '0')}` // Mon 7 Dec .. Sun 13 Dec
    for (const hhmm of ['04:30', '20:30'])
      inZone('UTC', () => {
        const at = manilaMoment(date, hhmm)
        assert.equal(todayISO(at), date, `${date} ${hhmm}`)
        assert.equal(todayName(at), names[i], `${date} ${hhmm}`)
      })
  }
})

test('helpers: Manila clock times, timestamps to dates, days ago, calendar dates', () => {
  assert.equal(manilaMoment('2026-12-02', '04:30'), AT.wed0430)
  assert.equal(manilaMoment('2026-12-02', '20:30'), AT.wed2030)
  for (const tz of ZONES)
    inZone(tz, () => {
      assert.equal(manilaDateISO('2026-12-01T20:30:00.000Z'), '2026-12-02', tz)
      assert.equal(daysAgoISO(2, AT.wed0430), '2026-11-30', tz)
      assert.equal(daysAgoISO(0, AT.thu0000), '2026-12-03', tz)
      // A calendar date is shown as written, never a day earlier or later.
      assert.match(formatDate('2026-12-02'), /Dec 2, 2026/, tz)
    })
})

// ---------- Server: Start Route and automatic messages use the Manila date ----------
let server, base, api
before(async () => {
  delete process.env.SMTP_HOST
  mock.timers.enable({ apis: ['Date'], now: AT.wed0430 })
  api = createApi({ db: openDatabase(':memory:'), tickMs: 0 })
  const app = express()
  app.use('/api', api.router)
  await new Promise((r) => (server = app.listen(0, r)))
  base = `http://localhost:${server.address().port}/api`
})
after(() => {
  api.close()
  server.close()
  mock.timers.reset()
})
const call = async (path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const login = async (role, identifier, password) => (await call('/auth/login', { body: { role, identifier, password } })).json.token
const act = (token, type, payload) => call('/actions', { token, body: { type, payload } })

test('Start Route: allowed at 4:30 AM on a Manila collection day, refused on a Manila non-collection day', async () => {
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')

  // Wednesday 04:30 Manila (Tuesday in UTC): a collection day.
  mock.timers.setTime(AT.wed0430)
  const ok = await act(drv, 'run/start', {})
  assert.equal(ok.status, 200, JSON.stringify(ok.json))
  const run = ok.json.data.runs[0]
  assert.equal(run.date, '2026-12-02', 'the run has the Manila date')
  assert.ok(run.id.startsWith('RUN-2026-12-02'))
  assert.equal((await act(adm, 'run/end', {})).status, 200)

  // Wednesday 20:30 Manila: still Wednesday.
  mock.timers.setTime(AT.wed2030)
  assert.equal((await act(drv, 'run/start', {})).status, 200)
  assert.equal((await act(adm, 'run/end', {})).status, 200)

  // Thursday 04:30 Manila (still Wednesday in UTC): no collection.
  mock.timers.setTime(AT.thu0430)
  const refused = await act(drv, 'run/start', {})
  assert.equal(refused.status, 409)
  assert.match(refused.json.error, /No collection today/)
})

test('pickup reminder and Pick Up Check use the Manila date and Manila clock', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const keys = async () => (await call('/state', { token: adm })).json.data.notifications.map((n) => n.key).filter(Boolean)

  // Thursday 04:30 Manila (Wednesday in UTC): no reminder for either day.
  mock.timers.setTime(AT.thu0430)
  api.service.tick(AT.thu0430)
  assert.ok(!(await keys()).some((k) => k.startsWith('schedule-2026-12-0')), 'no reminder on a Manila Thursday')

  // Wednesday 9 Dec, 04:30 Manila: reminder for the 9th; the Pick Up Check
  // waits until 05:00 Manila (one hour before the 06:00 AM window).
  const wed = manilaMoment('2026-12-09', '04:30')
  mock.timers.setTime(wed)
  api.service.tick(wed)
  let k = await keys()
  assert.ok(k.includes('schedule-2026-12-09'), 'reminder for the Manila date')
  assert.ok(!k.includes('pickup-check-2026-12-09'), 'Pick Up Check not before 05:00 Manila')

  const five = manilaMoment('2026-12-09', '05:00')
  mock.timers.setTime(five)
  api.service.tick(five)
  k = await keys()
  assert.ok(k.includes('pickup-check-2026-12-09'), 'Pick Up Check at 05:00 Manila')
  assert.ok(!k.some((x) => x === 'schedule-2026-12-08' || x === 'pickup-check-2026-12-08'), 'nothing under the UTC date')
})
