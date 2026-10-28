// Resident pickup feedback, driver problem reports, and the driver's queue
// workflow (Mark as Collected -> End My Shift). Run with: npm test
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { openDatabase } from '../server/db.js'
import { createApi } from '../server/app.js'
import { loadState } from '../server/repository.js'
import { dataReducer, currentRun } from '../src/store/dataReducer.js'
import { createInitialData } from '../src/store/initialData.js'
import { summarizeFeedback, summarizeRunsInRange } from '../src/store/selectors.js'
import { todayISO, todayName } from '../src/utils/format.js'

// Pin the clock to a Wednesday (an official collection day) so the tests do
// not depend on the real weekday. Tests move it to a Tuesday where needed.
export const WEDNESDAY = new Date('2026-10-28T09:00:00')
export const TUESDAY = new Date('2026-10-27T09:00:00')
mock.timers.enable({ apis: ['Date'], now: WEDNESDAY })


// ---------- Pure reducer / selector checks ----------
const act = (s, type, payload) => dataReducer(s, { type, payload })

test('feedback: one record per resident per day, latest answer kept', () => {
  let s = createInitialData()
  const base = { residentId: 'RES-402', residentName: 'Maria', purok: 'Purok 2', date: '2026-10-27' }
  s = act(s, 'feedback/submit', { ...base, willDispose: true })
  s = act(s, 'feedback/submit', { ...base, willDispose: true, truckPassed: true })
  s = act(s, 'feedback/submit', { ...base, willDispose: true, truckPassed: true, disposed: true })
  assert.equal(s.collectionFeedback.length, 1)
  const f = s.collectionFeedback[0]
  assert.deepEqual([f.willDispose, f.truckPassed, f.disposed], [true, true, true])
  // A different day is a separate record.
  s = act(s, 'feedback/submit', { ...base, date: '2026-10-28', willDispose: false })
  assert.equal(s.collectionFeedback.length, 2)
})

test('feedback with a follow-up reason creates exactly one resident report', () => {
  let s = createInitialData()
  const reports = s.reports.length
  const p = {
    residentId: 'RES-402',
    date: '2026-10-27',
    willDispose: true,
    truckPassed: false,
    disposed: false,
    reason: 'truck-did-not-pass',
    report: { residentId: 'RES-402', category: 'no-truck', categoryLabel: 'Garbage Truck Did Not Arrive', location: 'Purok 2', description: 'x' },
  }
  s = act(s, 'feedback/submit', p)
  s = act(s, 'feedback/submit', p) // answered again
  assert.equal(s.reports.length, reports + 1)
  assert.equal(s.collectionFeedback[0].reportId, s.reports[0].id)
  assert.ok(s.notifications[0].title.includes(s.reports[0].id), 'office alerted')
})

test('summary counts answers separately ("will dispose" is not "disposed")', () => {
  const rows = [
    { residentId: 'A', date: '2026-10-27', willDispose: true, truckPassed: null, disposed: null },
    { residentId: 'B', date: '2026-10-27', willDispose: true, truckPassed: true, disposed: true },
    { residentId: 'C', date: '2026-10-27', willDispose: true, truckPassed: false, disposed: false, reason: 'truck-did-not-pass' },
    { residentId: 'D', date: '2026-10-27', willDispose: false, truckPassed: null, disposed: null },
    { residentId: 'A', date: '2026-10-20', willDispose: true, truckPassed: true, disposed: false, reason: 'missed-schedule' },
  ]
  const s = summarizeFeedback(rows, { from: '2026-10-27', to: '2026-10-27' })
  assert.equal(s.responses, 4)
  assert.deepEqual([s.willYes, s.willNo], [3, 1])
  assert.deepEqual([s.passedYes, s.passedNo, s.passedUnanswered], [1, 1, 1])
  assert.deepEqual([s.disposedYes, s.disposedNo, s.disposedUnanswered], [1, 1, 1])
  assert.deepEqual(s.reasons, { 'truck-did-not-pass': 1 })
  assert.deepEqual(s.percent, { willYes: 75, passedYes: 50, disposedYes: 50 })
  assert.equal(summarizeFeedback(rows).residents, 4, 'all time: 4 different residents')
})

test('marking a stop collected twice keeps one record (no duplicate)', () => {
  let s = act(createInitialData(), 'run/start', { by: 'driver', driverId: 'DRV-01' })
  s = act(s, 'collection/mark', { stopId: 'STP-02', status: 'collected', by: 'driver' })
  const again = act(s, 'collection/mark', { stopId: 'STP-02', status: 'collected', by: 'driver' })
  assert.equal(again, s, 'second tap changes nothing')
})

test('driver problem is saved even when not at a stop', () => {
  let s = act(createInitialData(), 'run/start', { by: 'driver', driverId: 'DRV-01' })
  s = act(s, 'driver/reportIssue', { driverId: 'DRV-01', driverName: 'Carlos Ortiz', stopId: null, stopName: null, issueType: 'truck', issueLabel: 'Truck problem', description: 'Flat tire near the depot', notifyDispatch: false, markMissed: true })
  assert.equal(s.driverIssues.length, 1)
  assert.equal(s.driverIssues[0].runId, currentRun(s).id)
  assert.equal(s.driverIssues[0].markedMissed, false, 'nothing to mark without a stop')
  assert.equal(Object.keys(currentRun(s).results).length, 0)
})

// ---------- Through the API, with a database file ----------
let server, base, api, dir, dbPath
before(async () => {
  delete process.env.SMTP_HOST
  dir = mkdtempSync(join(tmpdir(), 'cleantrack-'))
  dbPath = join(dir, 'test.db')
  api = createApi({ db: openDatabase(dbPath), tickMs: 0 })
  const app = express()
  app.use('/api', api.router)
  await new Promise((r) => (server = app.listen(0, r)))
  base = `http://localhost:${server.address().port}/api`
})
after(() => {
  api.close()
  server.close()
  api.db.close()
  rmSync(dir, { recursive: true, force: true })
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
const send = (token, type, payload) => call('/actions', { token, body: { type, payload } })

test('API: resident feedback is validated, de-duplicated, private, and reaches the admin', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const res = await login('resident', 'maria.santos@email.com', 'resident123')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  const day = todayName()

  // Not a collection day (Tuesday) -> the question is refused, and the admin
  // cannot make Tuesday a regular collection day.
  mock.timers.setTime(TUESDAY.getTime())
  assert.equal((await send(res, 'feedback/submit', { willDispose: true })).status, 409)
  assert.equal((await send(adm, 'schedule/update', { day: 'Tuesday', patch: { window: '06:00 AM - 10:00 AM' } })).status, 400)
  assert.equal((await send(drv, 'run/start', {})).status, 409, 'no regular route on Tuesday')
  mock.timers.setTime(WEDNESDAY.getTime())
  assert.equal(day, 'Wednesday')
  assert.equal((await send(adm, 'schedule/update', { day, patch: { window: '06:00 AM - 10:00 AM' } })).status, 200)

  assert.equal((await send(drv, 'feedback/submit', { willDispose: true })).status, 403, 'drivers cannot answer')
  assert.equal((await send(res, 'feedback/submit', {})).status, 400)
  assert.equal((await send(res, 'feedback/submit', { willDispose: 'yes' })).status, 400)
  assert.equal(
    (await send(res, 'feedback/submit', { willDispose: true, truckPassed: true, disposed: false, reason: 'truck-did-not-pass' })).status,
    400,
    'reason must fit the earlier answer',
  )
  assert.equal((await send(res, 'feedback/submit', { willDispose: true, truckPassed: false, disposed: false, reason: 'other', reasonText: '' })).status, 400)

  // Step by step, as the app does it. The server decides who and which day.
  await send(res, 'feedback/submit', { willDispose: true, residentId: 'RES-999', date: '2000-01-01' })
  await send(res, 'feedback/submit', { willDispose: true, truckPassed: true })
  const done = await send(res, 'feedback/submit', { willDispose: true, truckPassed: true, disposed: false, reason: 'truck-did-not-stop', reasonText: 'Passed at 7 AM, no stop' })
  assert.equal(done.status, 200)
  const mine = done.json.data.collectionFeedback
  assert.equal(mine.length, 1)
  assert.equal(mine[0].residentId, 'RES-402')
  assert.equal(mine[0].date, todayISO())
  assert.ok(mine[0].reportId, 'follow-up report created')
  assert.ok(done.json.data.reports.some((r) => r.id === mine[0].reportId), 'resident sees the report in My Reports')

  // Admin sees it; the driver does not.
  const adminData = (await call('/state', { token: adm })).json.data
  assert.equal(adminData.collectionFeedback.length, 1)
  assert.equal(adminData.reports.find((r) => r.id === mine[0].reportId).category, 'missed')
  assert.equal((await call('/state', { token: drv })).json.data.collectionFeedback.length, 0)

  // Stored in its own table, one row per resident per day.
  const rows = api.db.prepare('SELECT * FROM collection_feedback').all()
  assert.equal(rows.length, 1)
  assert.deepEqual([rows[0].will_dispose, rows[0].truck_passed, rows[0].disposed, rows[0].reason], [1, 1, 0, 'truck-did-not-stop'])

  // Changing the first answer to "No" clears the later answers.
  const changed = await send(res, 'feedback/submit', { willDispose: false, truckPassed: true, disposed: true })
  const f = changed.json.data.collectionFeedback[0]
  assert.deepEqual([f.willDispose, f.truckPassed, f.disposed, f.reason], [false, null, null, null])
  assert.equal(api.db.prepare('SELECT count(*) n FROM collection_feedback').get().n, 1)
})

test('API: driver queue workflow, problem report, End My Shift; all saved', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')

  // Problem from Home (no stop) is saved and visible to the admin.
  const issue = await send(drv, 'driver/reportIssue', { issueType: 'truck', issueLabel: 'Truck problem', description: 'Brake light is not working', notifyDispatch: true })
  assert.equal(issue.status, 200)
  const adminIssues = (await call('/state', { token: adm })).json.data.driverIssues
  assert.equal(adminIssues.length, 1)
  assert.equal(adminIssues[0].driverId, 'DRV-01')
  assert.equal(adminIssues[0].stopId, null)

  assert.equal((await send(drv, 'run/start', {})).status, 200)
  const stops = (await call('/state', { token: drv })).json.data.runs[0].stops
  assert.equal((await send(drv, 'run/end', {})).status, 409, 'cannot end the shift before every stop is collected')
  assert.equal((await send(drv, 'collection/mark', { stopId: stops[1].id, status: 'collected', bags: 40 })).json.data.runs[0].results[stops[1].id].bags, null, 'bag counts ignored')
  for (const stop of stops) {
    assert.equal((await send(drv, 'collection/mark', { stopId: stop.id, status: 'collected' })).status, 200)
  }
  // Repeated tap: still one record per stop.
  await send(drv, 'collection/mark', { stopId: stops[0].id, status: 'collected' })
  assert.equal(api.db.prepare('SELECT count(*) n FROM collection_records').get().n, stops.length)

  assert.equal((await send(drv, 'run/end', {})).status, 200)
  const run = (await call('/state', { token: adm })).json.data.runs[0]
  assert.equal(run.status, 'completed')
  assert.ok(run.endedAt, 'completion time saved')

  // Admin analytics helpers agree with the saved records.
  const totals = summarizeRunsInRange([run], { from: todayISO(), to: todayISO() })
  assert.equal(totals.collected, stops.length)
  assert.equal(totals.percent, 100)
})

test('API: data survives a server restart (read back from the database file)', () => {
  const reopened = loadState(openDatabase(dbPath))
  assert.equal(reopened.collectionFeedback.length, 1)
  assert.equal(reopened.collectionFeedback[0].willDispose, false)
  assert.equal(reopened.driverIssues.length, 1)
  assert.equal(reopened.runs[0].status, 'completed')
})

test('API: office phone setting is validated and shared with the driver app', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  assert.equal((await call('/state', { token: drv })).json.data.settings.officePhone, '', 'empty until set')
  assert.equal((await send(adm, 'settings/update', { officePhone: 'call me' })).status, 400)
  assert.equal((await send(adm, 'settings/update', { officePhone: '(02) 8123 4567' })).status, 200)
  assert.equal((await call('/state', { token: drv })).json.data.settings.officePhone, '(02) 8123 4567')
})

test('API: crew members are managed by the admin only and saved', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  assert.equal((await send(drv, 'crew/add', { name: 'Ben Reyes', role: 'Garbage Collector' })).status, 403)
  assert.equal((await send(adm, 'crew/add', { name: 'Ben Reyes', role: 'Astronaut' })).status, 400)
  assert.equal((await send(adm, 'crew/add', { name: 'Ben Reyes', role: 'Garbage Collector', phone: 'abc' })).status, 400)
  const added = await send(adm, 'crew/add', { name: 'Ben  Reyes', role: 'Garbage Collector', truckId: 'TRK-01' })
  assert.equal(added.status, 200)
  const ben = added.json.data.crew[0]
  assert.deepEqual([ben.name, ben.truckId, ben.status, ben.phone], ['Ben Reyes', 'TRK-01', 'active', ''])
  const driversBefore = JSON.stringify(added.json.data.drivers)
  const upd = await send(adm, 'crew/update', { id: ben.id, patch: { ...ben, role: 'Crew Leader', status: 'inactive', truckId: null, phone: '0917 555 0100' } })
  const c = upd.json.data.crew[0]
  assert.deepEqual([c.role, c.status, c.truckId], ['Crew Leader', 'inactive', null])
  assert.equal(JSON.stringify(upd.json.data.drivers), driversBefore, 'driver records untouched')
  assert.equal(api.db.prepare('SELECT role FROM crew_members WHERE id = ?').get(ben.id).role, 'Crew Leader')
  assert.equal((await call('/state', { token: drv })).json.data.crew.length, 0, 'crew list is admin-only')
  assert.equal((await send(adm, 'crew/delete', { id: ben.id })).json.data.crew.length, 0)
})

test('Pick Up Check notification: once per pickup day; answering marks it read', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const res = await login('resident', 'maria.santos@email.com', 'resident123')
  // Window starting at 12:00 AM: the check is due all day (asked ~1 hour before start).
  await send(adm, 'schedule/update', { day: todayName(), patch: { window: '12:00 AM - 11:00 PM' } })
  api.service.tick()
  api.service.tick()
  const key = `pickup-check-${todayISO()}`
  assert.equal(api.db.prepare('SELECT count(*) n FROM notifications WHERE key = ?').get(key).n, 1)
  // Maria already answered today (earlier test), so the server marks it read after her next answer.
  await send(res, 'feedback/submit', { willDispose: true })
  const note = (await call('/state', { token: res })).json.data.notifications.find((n) => n.key === key)
  assert.ok(note, 'resident receives it')
  assert.equal(note.read, true, 'answered -> no longer shown as new')
  await send(adm, 'settings/update', { autoPickupCheck: false })
  assert.equal((await call('/state', { token: adm })).json.data.settings.autoPickupCheck, false)
})

// ---------- Images, profile pictures, crew view, schedule ----------
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const getImage = (ref, token) => fetch(`${base}/images/${ref.slice(4)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

test('API: report photo is stored privately and shown to the admin (the attachment bug)', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const res = await login('resident', 'maria.santos@email.com', 'resident123')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  assert.equal((await send(res, 'report/add', { category: 'missed', location: 'Purok 2', photo: 'data:text/html;base64,PGgxPg==' })).status, 400, 'only images')
  const sent = await send(res, 'report/add', { category: 'missed', location: 'Demo address, Purok 2', description: 'Bags left', photo: PNG })
  assert.equal(sent.status, 200)
  const report = sent.json.data.reports[0]
  assert.match(report.photo, /^upl:[a-f0-9]{32}$/, 'record keeps a reference, not the image')
  const row = api.db.prepare('SELECT photo FROM reports WHERE id = ?').get(report.id)
  assert.equal(row.photo, report.photo, 'reference saved with the report')
  // Admin (any admin session) sees it in the report details.
  const adminReport = (await call('/state', { token: adm })).json.data.reports.find((r) => r.id === report.id)
  assert.equal(adminReport.photo, report.photo)
  const img = await getImage(report.photo, adm)
  assert.equal(img.status, 200)
  assert.equal(img.headers.get('content-type'), 'image/png')
  assert.equal(img.headers.get('cache-control'), 'private, max-age=86400')
  // The resident who sent it may see it; nobody else; never without signing in.
  assert.equal((await getImage(report.photo, res)).status, 200)
  assert.equal((await getImage(report.photo, drv)).status, 403)
  assert.equal((await getImage(report.photo)).status, 401)
  const other = (await call('/auth/register', { body: { name: 'Ana Cruz', phone: '0918 777 1234', street: 'Lot 9 Demo St', purok: 'Purok 2', password: 'ana123' } })).json.token
  assert.equal((await getImage(report.photo, other)).status, 403, 'another resident cannot see it')
  assert.equal((await fetch(`${base}/images/notanid`, { headers: { Authorization: `Bearer ${adm}` } })).status, 404)
})

test('API: profile pictures belong to the right person; replaced pictures are removed', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const res = await login('resident', 'maria.santos@email.com', 'resident123')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')

  // Admin's own picture.
  const a1 = (await send(adm, 'admin/setPhoto', { photo: PNG })).json.data.adminPhoto
  assert.match(a1, /^upl:/)
  assert.equal((await send(res, 'admin/setPhoto', { photo: PNG })).status, 403)
  const a2 = (await send(adm, 'admin/setPhoto', { photo: PNG })).json.data.adminPhoto
  assert.notEqual(a1, a2)
  assert.equal((await getImage(a1, adm)).status, 404, 'old picture deleted')
  assert.equal((await getImage(a2, drv)).status, 403, 'admin picture is admin-only')

  // Resident: own picture only.
  const mine = (await send(res, 'resident/update', { id: 'RES-402', patch: { photo: PNG } })).json.data.residents[0].photo
  assert.match(mine, /^upl:/)
  assert.equal((await getImage(mine, res)).status, 200)
  const ana = await login('resident', '0918 777 1234', 'ana123')
  assert.equal((await send(ana, 'resident/update', { id: 'RES-402', patch: { photo: PNG } })).status, 403)
  assert.equal((await getImage(mine, ana)).status, 403)

  // Driver and crew pictures (admin); one person's change never touches another.
  const d = (await send(adm, 'driver/update', { id: 'DRV-01', patch: { photo: PNG } })).json.data.drivers.find((x) => x.id === 'DRV-01')
  assert.match(d.photo, /^upl:/)
  assert.equal((await send(drv, 'driver/update', { id: 'DRV-01', patch: { photo: PNG } })).status, 403, 'drivers cannot change pictures')
  const crewRes = await send(adm, 'crew/add', { name: 'Lito Ramos', role: 'Garbage Collector', truckId: 'TRK-01', photo: PNG })
  const lito = crewRes.json.data.crew.find((c) => c.name === 'Lito Ramos')
  await send(adm, 'crew/add', { name: 'Joy Dizon', role: 'Helper / Loader', truckId: 'TRK-01' })
  await send(adm, 'crew/add', { name: 'Off Truck', role: 'Helper / Loader', truckId: null })
  const after = (await send(adm, 'crew/update', { id: lito.id, patch: { ...lito, photo: null } })).json.data
  assert.equal(after.crew.find((c) => c.id === lito.id).photo, null)
  assert.equal(after.drivers.find((x) => x.id === 'DRV-01').photo, d.photo, 'driver picture unchanged')
  assert.equal((await getImage(lito.photo, adm)).status, 404, 'removed picture deleted')

  // Driver sees only the active crew of their own truck, with pictures.
  await send(adm, 'crew/update', { id: lito.id, patch: { ...lito, photo: PNG } })
  const driverCrew = (await call('/state', { token: drv })).json.data.crew
  assert.deepEqual(driverCrew.map((c) => c.name).sort(), ['Joy Dizon', 'Lito Ramos'])
  assert.deepEqual(Object.keys(driverCrew[0]).sort(), ['id', 'name', 'photo', 'role'])
  const litoNow = driverCrew.find((c) => c.name === 'Lito Ramos')
  assert.equal((await getImage(litoNow.photo, drv)).status, 200, 'driver can see crew picture')
  assert.equal((await getImage(litoNow.photo, res)).status, 403)
  assert.equal((await call('/state', { token: res })).json.data.crew.length, 0)
})

test('schedule: Monday, Wednesday and Friday only, whatever the saved rows say', () => {
  const db = openDatabase(':memory:')
  // An older database row that still makes Tuesday a collection day.
  createApi({ db, tickMs: 0 }).close()
  db.prepare("UPDATE schedules SET waste_type = 'Recyclables (Plastics, Cartons, Metals)', time_window = '06:00 AM - 10:00 AM' WHERE day = 'Tuesday'").run()
  db.prepare("UPDATE schedules SET time_window = '07:00 AM - 09:00 AM' WHERE day = 'Monday'").run()
  const s = loadState(db)
  const days = s.weeklySchedule.filter((d) => d.wasteType !== 'No collection').map((d) => d.day)
  assert.deepEqual(days, ['Monday', 'Wednesday', 'Friday'])
  assert.equal(s.weeklySchedule.find((d) => d.day === 'Monday').window, '07:00 AM - 09:00 AM', 'saved times kept')
  db.close()
})

test('API: a stop recorded by the office on a non-collection day is a special run', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  mock.timers.setTime(new Date('2026-10-31T09:00:00').getTime()) // Saturday
  try {
    const r = await send(adm, 'collection/mark', { stopId: 'STP-03', status: 'collected' })
    assert.equal(r.status, 200)
    const run = r.json.data.runs.find((x) => x.date === '2026-10-31')
    assert.equal(run.special, true)
    assert.equal(api.db.prepare('SELECT special FROM collection_runs WHERE id = ?').get(run.id).special, 1)
  } finally {
    mock.timers.setTime(WEDNESDAY.getTime())
  }
})

test('API: holidays / suspensions cancel the pickup everywhere and are saved', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const res = await login('resident', 'maria.santos@email.com', 'resident123')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  const today = todayISO() // Wednesday 2026-10-28 (pinned)
  assert.equal((await send(res, 'schedule/addException', { date: today, kind: 'holiday', reason: 'Test' })).status, 403)
  assert.equal((await send(adm, 'schedule/addException', { date: '2026-10-27', kind: 'holiday', reason: 'Tuesday' })).status, 400, 'not a pickup day')
  assert.equal((await send(adm, 'schedule/addException', { date: '2026-10-26', kind: 'holiday', reason: 'Past' })).status, 400, 'past date')
  assert.equal((await send(adm, 'schedule/addException', { date: today, kind: 'party', reason: 'Nope' })).status, 400)

  const added = await send(adm, 'schedule/addException', { date: today, kind: 'suspended', reason: 'Truck under repair' })
  assert.equal(added.status, 200)
  assert.deepEqual(added.json.data.scheduleExceptions.map((x) => x.date), [today])
  const state = (await call('/state', { token: res })).json.data
  assert.equal(state.scheduleExceptions.length, 1, 'residents see it (calendar)')
  assert.ok(state.notifications.some((n) => n.key === `exception-${today}`), 'residents notified')
  assert.equal((await send(res, 'feedback/submit', { willDispose: true })).status, 409, 'no Pick Up Check on a suspended day')
  assert.equal((await send(drv, 'run/start', {})).status, 409, 'no regular route on a suspended day')
  assert.equal(api.db.prepare('SELECT reason FROM schedule_exceptions WHERE date = ?').get(today).reason, 'Truck under repair')

  assert.equal((await send(adm, 'schedule/removeException', { date: today })).json.data.scheduleExceptions.length, 0)
  assert.equal((await send(res, 'feedback/submit', { willDispose: true })).status, 200, 'pickup day again')
})
