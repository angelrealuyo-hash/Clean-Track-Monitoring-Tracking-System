// Official Philippine holidays in the Resident pickup schedule. Run with: npm test
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { openDatabase } from '../server/db.js'
import { createApi } from '../server/app.js'
import { holidaysListedFor, isResidentPickupDate, phHolidayOn, phHolidaysOf, pickupCancelledBy } from '../src/resident/data/phHolidays.js'
import { dayStatus } from '../src/data/calendarStatus.js'
import { isPickupDate } from '../src/data/schedule.js'

const CHRISTMAS_2026 = new Date('2026-12-25T09:00:00') // a Friday (collection day)
const MONDAY_AFTER = new Date('2026-12-28T09:00:00') // a regular Monday
mock.timers.enable({ apis: ['Date'], now: CHRISTMAS_2026 })

// ---------- The data itself ----------
// Easter Sunday (Gregorian computus), to check the movable Holy Week dates.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  return new Date(Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1))
}
const plusDays = (date, n) => new Date(date.getTime() + n * 86_400_000).toISOString().slice(0, 10)
const find = (year, name) => phHolidaysOf(year).find((h) => h.name === name)?.date

test('holiday data: proclaimed years, valid dates, movable holidays on the right days', () => {
  for (const year of [2025, 2026, 2027]) {
    assert.ok(holidaysListedFor(year))
    const list = phHolidaysOf(year)
    assert.equal(new Set(list.map((h) => h.date)).size, list.length, 'no duplicate dates')
    for (const h of list) {
      assert.ok(h.date.startsWith(`${year}-`) && !Number.isNaN(new Date(`${h.date}T00:00`).getTime()), h.date)
      assert.ok(['regular', 'special'].includes(h.type))
      assert.match(h.proclamation, /^Proc\. No\. \d+, s\. \d{4}$/)
    }
    const e = easter(year)
    assert.equal(find(year, 'Maundy Thursday'), plusDays(e, -3))
    assert.equal(find(year, 'Good Friday'), plusDays(e, -2))
    assert.equal(find(year, 'Black Saturday'), plusDays(e, -1))
    const heroes = new Date(`${find(year, 'National Heroes Day')}T00:00`)
    assert.equal(heroes.getDay(), 1, 'Monday')
    assert.equal(new Date(heroes.getTime() + 7 * 86_400_000).getMonth(), 8, 'last Monday of August')
    for (const [md, name] of [['01-01', "New Year's Day"], ['04-09', 'Araw ng Kagitingan'], ['05-01', 'Labor Day'], ['06-12', 'Independence Day'], ['08-21', 'Ninoy Aquino Day'], ['11-01', "All Saints' Day"], ['11-30', 'Bonifacio Day'], ['12-08', 'Feast of the Immaculate Conception of Mary'], ['12-25', 'Christmas Day'], ['12-30', 'Rizal Day'], ['12-31', 'Last Day of the Year']])
      assert.equal(phHolidayOn(`${year}-${md}`)?.name, name, `${year}-${md}`)
    // The EDSA anniversary is a special WORKING day: not a holiday.
    assert.equal(phHolidayOn(`${year}-02-25`), null)
  }
  assert.deepEqual([find(2025, 'Chinese New Year'), find(2026, 'Chinese New Year'), find(2027, 'Chinese New Year')], ['2025-01-29', '2026-02-17', '2027-02-06'])
  assert.equal(phHolidayOn('2026-03-20').type, 'regular', "Eid'l Fitr 2026 (Proc. 1189)")
  assert.equal(phHolidayOn('2026-05-27').type, 'regular', "Eid'l Adha 2026 (Proc. 1264)")
  assert.equal(phHolidayOn('2026-11-16'), null, 'NCR-only days are not nationwide')
  assert.equal(holidaysListedFor(2028), false, 'no guessing for years not yet proclaimed')
  assert.equal(phHolidayOn('2028-12-25'), null)
})

test('holidays override the Monday / Wednesday / Friday pickup (never moved)', () => {
  assert.equal(isPickupDate('2026-12-25'), true, 'Christmas 2026 is a Friday')
  assert.equal(isResidentPickupDate('2026-12-25'), false)
  assert.equal(isResidentPickupDate('2026-11-30'), false, 'Bonifacio Day on a Monday')
  assert.equal(isResidentPickupDate('2027-01-01'), false, "New Year's Day on a Friday")
  assert.equal(isResidentPickupDate('2026-12-28'), true, 'the next Monday is a normal pickup day')
  assert.equal(isResidentPickupDate('2026-12-26'), false, 'Saturday stays a no-pickup day (nothing moved there)')
  assert.equal(isResidentPickupDate('2026-02-25'), true, 'special working day keeps its pickup')
  assert.equal(pickupCancelledBy('2026-12-25').reason, 'Christmas Day')
  // A barangay notice on the same date is still shown.
  assert.equal(pickupCancelledBy('2026-12-25', [{ date: '2026-12-25', kind: 'suspended', reason: 'Flooding' }]).reason, 'Flooding')
})

test('resident calendar: exclamation status on holidays of any weekday; saved answers kept', () => {
  const ctx = { today: '2026-12-01', feedback: [{ date: '2026-11-02', willDispose: true, truckPassed: true, disposed: true }] }
  const xmas = dayStatus('2026-12-25', ctx)
  assert.deepEqual([xmas.status, xmas.official.name, xmas.collectionDay], ['holiday', 'Christmas Day', true])
  const kagitingan = dayStatus('2026-04-09', ctx) // Thursday
  assert.deepEqual([kagitingan.status, kagitingan.official.name, kagitingan.collectionDay], ['holiday', 'Araw ng Kagitingan', false])
  assert.equal(dayStatus('2026-12-29', ctx), null, 'ordinary Tuesday: nothing')
  assert.equal(dayStatus('2026-12-28', ctx).status, 'scheduled')
  const souls = dayStatus('2026-11-02', ctx)
  assert.equal(souls.status, 'holiday')
  assert.equal(souls.answer.disposed, true, 'an earlier saved answer is still shown')
})

// ---------- Server: no reminder, no Pick Up Check, no answers on a holiday ----------
let server, base, api
before(async () => {
  api = createApi({ db: openDatabase(':memory:'), tickMs: 0 })
  const app = express()
  app.use('/api', api.router)
  await new Promise((r) => (server = app.listen(0, r)))
  base = `http://localhost:${server.address().port}/api`
})
after(() => {
  api.close()
  server.close()
})
const call = async (path, { token, body } = {}) => {
  const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const count = (key) => api.db.prepare('SELECT count(*) n FROM notifications WHERE key = ?').get(key).n

test('server: Christmas Day (Friday) has no reminder, no Pick Up Check and refuses answers', async () => {
  const adm = (await call('/auth/login', { body: { role: 'admin', identifier: 'admin@cleantrack.gov', password: 'SuperAdmin#2025' } })).json.token
  const res = (await call('/auth/login', { body: { role: 'resident', identifier: 'maria.santos@email.com', password: 'resident123' } })).json.token
  await call('/actions', { token: adm, body: { type: 'schedule/update', payload: { day: 'Friday', patch: { window: '12:00 AM - 11:00 PM' } } } })
  await call('/actions', { token: adm, body: { type: 'schedule/update', payload: { day: 'Monday', patch: { window: '12:00 AM - 11:00 PM' } } } })
  api.service.tick()
  assert.equal(count('pickup-check-2026-12-25'), 0)
  assert.equal(count('schedule-2026-12-25'), 0)
  const answer = await call('/actions', { token: res, body: { type: 'feedback/submit', payload: { willDispose: true } } })
  assert.equal(answer.status, 409)
  assert.match(answer.json.error, /Christmas Day/)

  // The next Monday is a normal pickup day again.
  mock.timers.setTime(MONDAY_AFTER.getTime())
  api.service.tick()
  assert.equal(count('pickup-check-2026-12-28'), 1)
  assert.equal(count('schedule-2026-12-28'), 1)
  assert.equal((await call('/actions', { token: res, body: { type: 'feedback/submit', payload: { willDispose: true } } })).status, 200)
})
