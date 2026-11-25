// Several trucks operating independently (Phase 1: data layer and server).
// Seven trucks and six routes (one per purok), each with its own driver, crew,
// route run and simulated GPS, started at the same time; drivers and residents
// only see their own truck; everything survives a server restart.
// Run with: npm test   (uses a temporary database file)
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { openDatabase } from '../server/db.js'
import { createApi } from '../server/app.js'
import { dataReducer } from '../src/store/dataReducer.js'
import { createInitialData } from '../src/store/initialData.js'
import { viewFor } from '../src/store/view.js'
import { truckForPurok, withoutLegacy } from '../src/store/fleet.js'

// A Wednesday (an official collection day), 09:00.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-28T09:00:00') })

const dir = mkdtempSync(join(tmpdir(), 'cleantrack-fleet-'))
const dbPath = join(dir, 'test.db')
let server, base, api, db

async function startServer() {
  db = openDatabase(dbPath)
  api = createApi({ db, tickMs: 0 })
  const app = express()
  app.use('/api', api.router)
  await new Promise((r) => (server = app.listen(0, r)))
  base = `http://localhost:${server.address().port}/api`
}
async function stopServer() {
  api.close()
  await new Promise((r) => server.close(r))
  db.close()
}
before(async () => {
  delete process.env.SMTP_HOST
  await startServer()
})
after(async () => {
  await stopServer()
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
const login = async (role, identifier, password) => (await call('/auth/login', { body: { role, identifier, password } })).json?.token
const admin = () => login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
const act = (token, type, payload) => call('/actions', { token, body: { type, payload } })
const ok = async (promise, label) => {
  const r = await promise
  assert.equal(r.status, 200, `${label}: ${JSON.stringify(r.json)}`)
  return r.json.data
}
const state = async (token) => (await call('/state', { token })).json.data

const PUROKS = ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Purok 5', 'Purok 6']
const TRUCK = (n) => ({ id: `TRK-0${n}`, plateNumber: `NBC ${100 + n}`, type: 'Mini Compactor', capacityTons: 5, fuel: 'Diesel Euro-4', status: 'active' })
const driverToken = {}

test('setup: seven trucks; six routes, one per purok; a driver for each route truck', async () => {
  const adm = await admin()
  for (let n = 2; n <= 7; n++) await ok(act(adm, 'truck/add', TRUCK(n)), `add TRK-0${n}`)

  // The demo route covers Purok 1-6. Keep only Purok 1 on it (TRK-01).
  let s = await state(adm)
  for (const stop of s.routes[0].stops.filter((x) => x.households > 0 && x.purok !== 'Purok 1')) await ok(act(adm, 'route/removeStop', { id: stop.id }), 'remove stop')

  // One purok, one truck: Purok 1 is on RT-01 and cannot be added elsewhere.
  s = await ok(act(adm, 'route/add', { name: 'Route 2' }), 'add route')
  const rt2 = s.routes.find((r) => r.name === 'Route 2')
  const taken = await act(adm, 'route/addStop', { afterId: rt2.stops[0].id, name: 'Corner A', purok: 'Purok 1', households: 10, coords: [14.601, 120.988] })
  assert.equal(taken.status, 409)
  assert.match(taken.json.error, /Purok 1 is already served by .*TRK-01/)
  assert.equal((await act(adm, 'route/add', { name: 'route 2' })).status, 409, 'route names are unique')

  for (let n = 2; n <= 6; n++) {
    s = n === 2 ? s : await ok(act(adm, 'route/add', { name: `Route ${n}`, startTime: '06:30 AM' }), `add Route ${n}`)
    const route = s.routes.find((r) => r.name === `Route ${n}`)
    await ok(act(adm, 'truck/assignRoute', { id: `TRK-0${n}`, routeId: route.id }), `assign route ${n}`)
    await ok(act(adm, 'route/addStop', { afterId: route.stops[0].id, name: `Stop ${n}`, purok: PUROKS[n - 1], households: 20, coords: [14.6 + n / 1000, 120.99] }), `stop ${n}`)
    await ok(
      act(adm, 'driver/add', { name: `Driver Number${n}`, phone: `0918 222 33${n}0`, license: 'Class 2', shift: 'morning', status: 'standby', email: `driver${n}@example.com`, password: 'driver123', truckId: `TRK-0${n}` }),
      `driver ${n}`,
    )
    s = await state(adm)
    const driver = s.drivers.find((d) => d.name === `Driver Number${n}`)
    assert.equal(driver.truckId, `TRK-0${n}`)
    await ok(act(adm, 'truck/assignDriver', { truckId: `TRK-0${n}`, driverId: driver.id }), `assign driver ${n}`)
    driverToken[`TRK-0${n}`] = await login('driver', `driver${n}@example.com`, 'driver123')
  }
  driverToken['TRK-01'] = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')

  // Seventh truck: a route, but every purok is already served (one purok, one truck).
  s = await ok(act(adm, 'route/add', { name: 'Route 7' }), 'add Route 7')
  const rt7 = s.routes.find((r) => r.name === 'Route 7')
  await ok(act(adm, 'truck/assignRoute', { id: 'TRK-07', routeId: rt7.id }), 'assign route 7')
  assert.equal((await act(adm, 'route/addStop', { afterId: rt7.stops[0].id, name: 'Corner Z', purok: 'Purok 6', households: 5, coords: [14.6, 120.99] })).status, 409)
  const noStops = await act(adm, 'run/start', { truckId: 'TRK-07' })
  assert.equal(noStops.status, 409)
  assert.match(noStops.json.error, /no pickup points/)

  s = await state(adm)
  assert.equal(s.trucks.length, 7)
  for (const purok of PUROKS) assert.ok(truckForPurok(s, purok), `${purok} has a truck`)
  assert.deepEqual(PUROKS.map((p) => truckForPurok(s, p).id), ['TRK-01', 'TRK-02', 'TRK-03', 'TRK-04', 'TRK-05', 'TRK-06'])
})

test('route rules: a route belongs to one truck; assigned routes cannot be deleted', async () => {
  const adm = await admin()
  const s = await state(adm)
  const rt2 = s.trucks.find((t) => t.id === 'TRK-02').routeId
  const r = await act(adm, 'truck/assignRoute', { id: 'TRK-07', routeId: rt2 })
  assert.equal(r.status, 409)
  assert.match(r.json.error, /already assigned to TRK-02/)
  assert.equal((await act(adm, 'route/delete', { id: rt2 })).status, 409)
  assert.equal((await act(adm, 'truck/delete', { id: 'TRK-02' })).status, 409, 'a truck with a route cannot be deleted')
})

test('crew limits are per truck: 3 per shift on each truck', async () => {
  const adm = await admin()
  for (let i = 1; i <= 3; i++) await ok(act(adm, 'crew/add', { name: `Crew Two${'abc'[i - 1]}`, shift: 'morning', status: 'active', truckId: 'TRK-02' }), `crew ${i}`)
  const full = await act(adm, 'crew/add', { name: 'Crew Twod', shift: 'morning', status: 'active', truckId: 'TRK-02' })
  assert.equal(full.status, 409, 'TRK-02 Morning crew is full')
  await ok(act(adm, 'crew/add', { name: 'Crew Threea', shift: 'morning', status: 'active', truckId: 'TRK-03' }), 'another truck has its own places')
  // Second Morning driver on TRK-02 refused; on TRK-07 (own shifts) fine.
  assert.equal((await act(adm, 'driver/add', { name: 'Extra Driver', phone: '0918 999 0001', license: 'Class 2', shift: 'morning', truckId: 'TRK-02' })).status, 409)
  await ok(act(adm, 'driver/add', { name: 'Extra Driver', phone: '0918 999 0001', license: 'Class 2', shift: 'morning', truckId: 'TRK-07' }), 'TRK-07 morning driver')
  const s = await state(adm)
  assert.equal(s.crew.filter((c) => c.truckId === 'TRK-02').length, 3)
  // A driver cannot drive a truck whose roster they are not on.
  const ortiz = s.drivers.find((d) => d.id === 'DRV-01')
  assert.equal((await act(adm, 'truck/assignDriver', { truckId: 'TRK-03', driverId: ortiz.id })).status, 409)
})

test('six trucks run their routes and simulated GPS at the same time, independently', async () => {
  const adm = await admin()
  for (let n = 1; n <= 6; n++) {
    const token = driverToken[`TRK-0${n}`]
    await ok(act(token, 'run/start', {}), `run TRK-0${n}`)
    await ok(act(token, 'sim/start', {}), `sim TRK-0${n}`)
  }
  let s = await state(adm)
  const active = [1, 2, 3, 4, 5, 6].map((n) => s.sessions[`TRK-0${n}`].activeRunId)
  assert.equal(new Set(active).size, 6, 'six different runs in progress')
  for (let n = 1; n <= 6; n++) {
    const id = `TRK-0${n}`
    const run = s.runs.find((r) => r.id === s.sessions[id].activeRunId)
    assert.equal(run.truckId, id)
    assert.equal(run.routeId, s.trucks.find((t) => t.id === id).routeId)
    assert.deepEqual([...new Set(run.stops.map((x) => x.purok))], [PUROKS[n - 1]], `${id} run covers only its purok`)
    assert.equal(s.sessions[id].simulation.status, 'running')
  }
  assert.equal(s.sessions['TRK-07'].simulation.status, 'idle')

  // Pausing TRK-01 and recording a TRK-02 stop affect only that truck.
  await ok(act(driverToken['TRK-01'], 'sim/pause', {}), 'pause TRK-01')
  const stop2 = s.routes.find((r) => r.id === s.trucks.find((t) => t.id === 'TRK-02').routeId).stops.find((x) => x.households > 0)
  await ok(act(driverToken['TRK-02'], 'collection/mark', { stopId: stop2.id, status: 'collected' }), 'TRK-02 stop')
  await ok(act(adm, 'run/end', { truckId: 'TRK-01' }), 'office ends TRK-01 route')
  s = await state(adm)
  assert.equal(s.sessions['TRK-01'].simulation.status, 'paused')
  assert.equal(s.sessions['TRK-01'].activeRunId, null)
  assert.equal(s.sessions['TRK-02'].simulation.status, 'running')
  assert.ok(s.sessions['TRK-02'].activeRunId, 'TRK-02 still on its route')
  const run2 = s.runs.find((r) => r.id === s.sessions['TRK-02'].activeRunId)
  assert.equal(run2.results[stop2.id].status, 'collected')
  for (const n of [3, 4, 5, 6]) assert.deepEqual(s.runs.find((r) => r.id === s.sessions[`TRK-0${n}`].activeRunId).results, {}, `TRK-0${n} has no records`)

  // Each truck's GPS points are logged with its truck.
  const log = (await call('/admin/locations?truck=TRK-02', { token: adm })).json.entries
  assert.ok(log.length > 0)
  assert.ok(log.every((e) => e.truck_id === 'TRK-02'))
})

test('drivers see and control only their own truck', async () => {
  const token = driverToken['TRK-02']
  const v = await state(token)
  assert.deepEqual(v.trucks.map((t) => t.id), ['TRK-02'])
  assert.deepEqual(v.routes.map((r) => r.id), [v.trucks[0].routeId])
  assert.deepEqual(Object.keys(v.sessions), ['TRK-02'])
  assert.ok(v.runs.length > 0 && v.runs.every((r) => r.truckId === 'TRK-02'))
  assert.equal(v.truck.id, 'TRK-02', 'older Driver screens show their own truck')
  assert.equal(v.route.id, v.trucks[0].routeId)
  assert.equal(v.activeRunId, v.sessions['TRK-02'].activeRunId)
  assert.equal(v.crew.length, 3, 'own Morning crew')

  const adm = await admin()
  const s = await state(adm)
  const rt1Stop = s.routes.find((r) => r.id === s.trucks.find((t) => t.id === 'TRK-01').routeId).stops.find((x) => x.households > 0)
  assert.equal((await act(token, 'collection/mark', { stopId: rt1Stop.id, status: 'collected' })).status, 404, "another truck's stop")
  assert.equal((await act(token, 'run/end', { truckId: 'TRK-03' })).status, 403)
  assert.equal((await act(token, 'sim/pause', { truckId: 'TRK-03' })).status, 403)
  assert.equal((await act(token, 'run/start', { truckId: 'TRK-01' })).status, 403)
  const after = await state(adm)
  assert.equal(after.sessions['TRK-03'].simulation.status, 'running', 'TRK-03 untouched')
})

test('residents see only the truck serving their purok; alerts come from that truck', async () => {
  const res = (await call('/auth/register', { body: { name: 'Lina Reyes', phone: '0918 444 5566', street: 'Lot 3 Demo St', purok: 'Purok 3', password: 'lina123' } })).json.token
  const v = await state(res)
  assert.deepEqual(v.trucks.map((t) => t.id), ['TRK-03'])
  assert.equal(v.truck.id, 'TRK-03')
  assert.equal(v.runs.length, 1)
  assert.equal(v.runs[0].truckId, 'TRK-03')
  assert.ok(v.activeRunId)

  // Pickup feedback is linked to the purok truck's run.
  const fb = await ok(act(res, 'feedback/submit', { willDispose: true }), 'feedback')
  assert.equal(fb.collectionFeedback[0].runId, v.runs[0].id)

  // "Truck is coming": one message per started truck (TRK-01 is paused on its
  // way, which counts, as before), each only for its own purok.
  api.service.tick()
  api.service.tick()
  const adm = await admin()
  const near = (await state(adm)).notifications.filter((n) => n.kind === 'proximity')
  assert.deepEqual(near.map((n) => `${n.truckId}:${n.zone}`).sort(), ['TRK-01:Purok 1', 'TRK-02:Purok 2', 'TRK-03:Purok 3', 'TRK-04:Purok 4', 'TRK-05:Purok 5', 'TRK-06:Purok 6'])
  const mine = (await state(res)).notifications.filter((n) => n.kind === 'proximity')
  assert.deepEqual(mine.map((n) => n.truckId), ['TRK-03'])
  assert.match(mine[0].body, /simulated/i)
})

test('trucks, routes, crews and every session survive a server restart', async () => {
  const before = withoutLegacy(await state(await admin()))
  await stopServer()
  await startServer()
  const s = withoutLegacy(await state(await admin()))
  assert.deepEqual(s.trucks, before.trucks)
  assert.deepEqual(s.routes, before.routes)
  assert.deepEqual(s.sessions, before.sessions)
  assert.deepEqual(s.crew, before.crew)
  assert.deepEqual(
    s.drivers.map((d) => [d.id, d.truckId, d.shift]),
    before.drivers.map((d) => [d.id, d.truckId, d.shift]),
  )
  assert.equal(db.prepare('SELECT COUNT(*) n FROM truck_sessions').get().n, 7)
  // The database itself refuses a route on two trucks.
  assert.throws(() => db.prepare("UPDATE trucks SET route_id = (SELECT route_id FROM trucks WHERE id = 'TRK-02') WHERE id = 'TRK-03'").run(), /UNIQUE/)
})

test('no six-truck limit: up to 50 trucks can be registered', async () => {
  const adm = await admin()
  const count = (await state(adm)).trucks.length
  for (let n = count + 1; n <= 50; n++) await ok(act(adm, 'truck/add', { ...TRUCK(0), id: `TRK-${n}`, plateNumber: `ZZZ ${n}` }), `truck ${n}`)
  const r = await act(adm, 'truck/add', { ...TRUCK(0), id: 'TRK-51', plateNumber: 'ZZZ 51' })
  assert.equal(r.status, 409)
  assert.match(r.json.error, /50 trucks/)
})

test('unassigning a route frees it; then the truck and route can be deleted', async () => {
  const adm = await admin()
  let s = await state(adm)
  const rt7 = s.trucks.find((t) => t.id === 'TRK-07').routeId
  await ok(act(adm, 'truck/assignRoute', { id: 'TRK-07', routeId: null }), 'unassign')
  await ok(act(adm, 'route/delete', { id: rt7 }), 'delete route')
  // TRK-07 still has a Morning driver on its roster: move them first.
  assert.equal((await act(adm, 'truck/delete', { id: 'TRK-07' })).status, 409)
  s = await state(adm)
  const extra = s.drivers.find((d) => d.name === 'Extra Driver')
  await ok(act(adm, 'driver/update', { id: extra.id, patch: { shift: null } }), 'take driver off the roster')
  await ok(act(adm, 'truck/delete', { id: 'TRK-07' }), 'delete truck')
  s = await state(adm)
  assert.ok(!s.trucks.some((t) => t.id === 'TRK-07'))
  assert.ok(!s.routes.some((r) => r.id === rt7))
  assert.ok(!('TRK-07' in s.sessions))
})

test('reducer: independent sessions and the derived single-truck fields', () => {
  let s = createInitialData()
  s = dataReducer(s, { type: 'truck/add', payload: TRUCK(2) })
  s = dataReducer(s, { type: 'route/add', payload: { name: 'Route 2', depot: [14.6, 120.98] } })
  s = dataReducer(s, { type: 'truck/assignRoute', payload: { id: 'TRK-02', routeId: 'RT-02' } })
  s = dataReducer(s, { type: 'sim/start', payload: { truckId: 'TRK-02' } })
  assert.equal(s.sessions['TRK-02'].simulation.status, 'running')
  assert.equal(s.sessions['TRK-01'].simulation.status, 'idle')
  assert.equal(s.simulation.status, 'idle', 'older screens show the first route truck (TRK-01)')
  // No-op actions return the same object (the server skips saving).
  assert.equal(dataReducer(s, { type: 'sim/start', payload: { truckId: 'TRK-02' } }), s)
  // Views: a driver's focus is their truck; driver notifications for other trucks are hidden.
  s = { ...s, drivers: s.drivers.map((d) => (d.id === 'DRV-02' ? { ...d, truckId: 'TRK-02', shift: 'morning' } : d)) }
  s = dataReducer(s, { type: 'truck/assignDriver', payload: { truckId: 'TRK-02', driverId: 'DRV-02' } })
  s = dataReducer(s, { type: 'notification/add', payload: { audience: 'driver', title: 'For TRK-01', truckId: 'TRK-01' } })
  s = dataReducer(s, { type: 'notification/add', payload: { audience: 'driver', title: 'For everyone' } })
  const v = viewFor(s, { role: 'driver', refId: 'DRV-02' })
  assert.equal(v.truck.id, 'TRK-02')
  assert.equal(v.simulation.status, 'running')
  assert.deepEqual(v.notifications.map((n) => n.title).filter((t) => t.startsWith('For')), ['For everyone'])
})
