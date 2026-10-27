// Run with: npm test   (uses a temporary in-memory database)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { openDatabase } from '../server/db.js'
import { createApi } from '../server/app.js'

let server, base, api
before(async () => {
  delete process.env.SMTP_HOST
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

const call = async (path, { token, body, method } = {}) => {
  const res = await fetch(base + path, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const login = async (role, identifier, password) => (await call('/auth/login', { body: { role, identifier, password } })).json.token
const act = (token, type, payload) => call('/actions', { token, body: { type, payload } })

test('sign-in: right password works, wrong password and missing token are refused', async () => {
  assert.equal((await call('/auth/login', { body: { role: 'admin', identifier: 'admin@cleantrack.gov', password: 'nope' } })).status, 401)
  assert.ok(await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025'))
  assert.ok(await login('resident', '0917 555 0192', 'resident123'), 'resident can use mobile number')
  assert.equal((await call('/state')).status, 401)
  assert.equal((await call('/state', { token: 'forged.token' })).status, 401)
})

test('role permissions: residents and drivers cannot do admin actions', async () => {
  const res = await login('resident', 'maria.santos@email.com', 'resident123')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  assert.equal((await act(res, 'truck/update', { plateNumber: 'X' })).status, 403)
  assert.equal((await act(drv, 'settings/update', { completionTarget: 70 })).status, 403)
  assert.equal((await act(drv, 'driver/update', { id: 'DRV-01', patch: { name: 'Hacker Name' } })).status, 403)
  assert.equal((await call('/admin/email-log', { token: res })).status, 403)
})

test('residents only see their own data; passwords are never sent', async () => {
  const res = await login('resident', 'maria.santos@email.com', 'resident123')
  const { json } = await call('/state', { token: res })
  assert.equal(json.data.residents.length, 1)
  assert.ok(json.data.reports.every((r) => r.residentId === 'RES-402'))
  assert.equal(json.data.broadcasts.length, 0)
  assert.ok(!JSON.stringify(json).includes('password'))
  assert.ok(json.data.drivers.every((d) => !d.phone), 'driver phone numbers hidden from residents')
})

test('server-side validation rejects bad input', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  assert.equal((await act(adm, 'truck/update', { plateNumber: '', type: 'Mini Compactor', fuel: 'Diesel', capacityTons: 5, status: 'active' })).status, 400)
  assert.equal((await act(adm, 'collection/mark', { stopId: 'STP-02', status: 'missed', note: '' })).status, 400, 'missed needs a reason')
  assert.equal((await act(adm, 'route/addStop', { name: 'X', purok: 'Purok 1', households: 5, coords: [1, 2], afterId: 'STP-02' })).status, 400)
  const reg = await call('/auth/register', { body: { name: 'A', phone: '123', street: 'x', purok: 'Purok 1', password: '1' } })
  assert.equal(reg.status, 400)
  const badEmail = await call('/auth/register', { body: { name: 'Ana Cruz', phone: '0918 000 1111', email: '"a;b"<x@y.com>', street: 'Lot 1 Demo St', purok: 'Purok 1', password: 'secret1' } })
  assert.equal(badEmail.status, 400, 'unsafe email formats rejected')
})

test('full workflow persists in the database and is shared across roles', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  const res = await login('resident', 'maria.santos@email.com', 'resident123')

  // Admin changes today's schedule -> resident sees it.
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  assert.equal((await act(adm, 'schedule/update', { day, patch: { wasteType: 'Recyclables (Plastics, Cartons, Metals)', window: '07:00 AM - 11:00 AM' } })).status, 200)
  const resState = (await call('/state', { token: res })).json.data
  assert.equal(resState.weeklySchedule.find((d) => d.day === day).window, '07:00 AM - 11:00 AM')

  // Driver starts the route and records a stop -> admin sees it with driver identity.
  assert.equal((await act(drv, 'run/start', { by: 'admin' })).status, 200)
  const marked = await act(drv, 'collection/mark', { stopId: 'STP-02', status: 'collected', bags: 9, by: 'admin', byName: 'Fake' })
  assert.equal(marked.status, 200)
  const admState = (await call('/state', { token: adm })).json.data
  const run = admState.runs.find((r) => r.id === admState.activeRunId)
  assert.equal(run.startedBy, 'driver', 'server decides who started it')
  assert.equal(run.results['STP-02'].by, 'driver', 'server fills in the real recorder')
  assert.equal(run.results['STP-02'].byName, 'Carlos Ortiz')

  // Resident reports -> admin sees it; admin resolves -> resident notified.
  const rep = await act(res, 'report/add', { category: 'missed', location: 'Demo address, Purok 2', residentId: 'RES-999' })
  assert.equal(rep.status, 200)
  const mine = rep.json.data.reports[0]
  assert.equal(mine.residentId, 'RES-402', 'cannot report as someone else')
  assert.equal((await act(adm, 'report/update', { id: mine.id, status: 'resolved', adminResponse: '' })).status, 400, 'resolve needs a reply')
  assert.equal((await act(adm, 'report/update', { id: mine.id, status: 'resolved', adminResponse: 'Collected at 3 PM.' })).status, 200)
  const after = (await call('/state', { token: res })).json.data
  assert.equal(after.reports.find((r) => r.id === mine.id).status, 'resolved')
  const note = after.notifications.find((n) => n.title.includes(mine.id))
  assert.ok(note && note.read === false)

  // Per-person read state.
  await act(res, 'notification/markRead', { id: note.id })
  assert.equal((await call('/state', { token: res })).json.data.notifications.find((n) => n.id === note.id).read, true)

  // Stored in the database tables (not just memory).
  const row = api.db.prepare("SELECT recorded_by, recorded_by_name, bags FROM collection_records WHERE stop_id = 'STP-02'").get()
  assert.deepEqual({ ...row }, { recorded_by: 'driver', recorded_by_name: 'Carlos Ortiz', bags: 9 })
  assert.equal(api.db.prepare('SELECT status FROM reports WHERE id = ?').get(mine.id).status, 'resolved')
  assert.ok(api.db.prepare("SELECT count(*) n FROM location_history WHERE source = 'SIMULATED'").get().n > 0, 'simulated location logged')
})

test('conflicts are prevented', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  // A route is in progress (from the previous test).
  assert.equal((await act(adm, 'truck/assignDriver', { driverId: 'DRV-02' })).status, 409)
  assert.equal((await act(adm, 'driver/delete', { id: 'DRV-01' })).status, 409)
  const r = await act(adm, 'truck/update', { plateNumber: 'ABC-1024', type: 'Mini Compactor', fuel: 'Diesel Euro-4', capacityTons: 5, status: 'maintenance' })
  assert.equal(r.status, 409)
})

test('emails are logged honestly when SMTP is not configured; duplicates prevented', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  await act(adm, 'broadcast/add', { zone: 'Purok 2', subject: 'Truck late', message: 'The truck will be 30 minutes late.', channels: ['App', 'Email'] })
  const { json } = await call('/admin/email-log', { token: adm })
  assert.equal(json.config.configured, false)
  const entry = json.entries.find((e) => e.subject.includes('Truck late'))
  assert.equal(entry.status, 'not_configured', 'never reported as sent')
  api.service.tick()
  api.service.tick()
  const n = api.db.prepare("SELECT count(*) n FROM notifications WHERE kind = 'schedule'").get().n
  assert.ok(n <= 1, 'pickup reminder created at most once per day')
})

test('driver account can be disabled', async () => {
  const adm = await login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
  const add = await act(adm, 'driver/add', { name: 'Juan Dela Cruz', phone: '0918 222 3333', license: 'Class 2', shift: 'Relief Driver', status: 'standby', email: 'juan@example.com', password: 'juan123' })
  assert.equal(add.status, 200)
  const juan = add.json.data.drivers.find((d) => d.name === 'Juan Dela Cruz')
  assert.equal(juan.account, 'active')
  assert.ok(await login('driver', 'juan@example.com', 'juan123'))
  await act(adm, 'driver/update', { id: juan.id, patch: { account: 'disabled' } })
  assert.equal((await call('/auth/login', { body: { role: 'driver', identifier: 'juan@example.com', password: 'juan123' } })).status, 403)
})

test('change password: needs the current password; new one works', async () => {
  const token = await login('resident', 'maria.santos@email.com', 'resident123')
  assert.equal((await call('/auth/password', { token, body: { current: 'wrong', next: 'newpass1' } })).status, 400)
  assert.equal((await call('/auth/password', { token, body: { current: 'resident123', next: 'newpass1' } })).status, 200)
  assert.ok(await login('resident', 'maria.santos@email.com', 'newpass1'))
  assert.equal(await login('resident', 'maria.santos@email.com', 'resident123'), undefined)
})
