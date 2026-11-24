// Truck Management: add, validate, edit, status, maintenance, service truck
// swap, delete with dependency checks, and persistence after a restart.
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
import { joinModel, nextTruckId, plateKey, splitModel, truckDeleteBlock } from '../src/data/truck.js'

// A Wednesday (an official collection day).
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-28T09:00:00') })

const dir = mkdtempSync(join(tmpdir(), 'cleantrack-trucks-'))
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
const login = async (role, identifier, password) => (await call('/auth/login', { body: { role, identifier, password } })).json.token
const admin = () => login('admin', 'admin@cleantrack.gov', 'SuperAdmin#2025')
const act = (token, type, payload) => call('/actions', { token, body: { type, payload } })
const state = async (token) => (await call('/state', { token })).json.data

const NEW_TRUCK = {
  id: 'TRK-02',
  plateNumber: 'nbc 2087',
  type: 'Dump Truck',
  year: 2021,
  model: 'Hino 300',
  capacityTons: 6,
  fuel: 'Diesel Euro-4',
  odometerKm: 1200,
  status: 'active',
}

test('helpers: year/model, plate matching, next id', () => {
  assert.deepEqual(splitModel('2022 Isuzu Elf N-Series'), { year: '2022', model: 'Isuzu Elf N-Series' })
  assert.deepEqual(splitModel('Isuzu Elf'), { year: '', model: 'Isuzu Elf' })
  assert.equal(joinModel(2021, ' Hino 300 '), '2021 Hino 300')
  assert.equal(joinModel('', 'Hino'), 'Hino')
  assert.equal(plateKey('abc 1024'), plateKey('ABC-1024'))
  assert.equal(nextTruckId([{ id: 'TRK-01' }, { id: 'TRK-07' }, { id: 'X' }]), 'TRK-08')
})

test('admin adds a truck; it is a reserve truck and appears in the list', async () => {
  const adm = await admin()
  const r = await act(adm, 'truck/add', NEW_TRUCK)
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const s = await state(adm)
  assert.equal(s.truck.id, 'TRK-01', 'service truck unchanged')
  const added = s.reserveTrucks.find((t) => t.id === 'TRK-02')
  assert.ok(added)
  assert.equal(added.plateNumber, 'NBC 2087')
  assert.equal(added.model, '2021 Hino 300')
  assert.equal(added.odometerKm, 1200)
  assert.equal(added.driverId, null)
  assert.equal(added.routeId, null)
  assert.deepEqual(added.maintenance, [])
})

test('Add Truck validates required fields', async () => {
  const adm = await admin()
  const bad = async (patch) => (await act(adm, 'truck/add', { ...NEW_TRUCK, id: 'TRK-50', plateNumber: 'ZZZ 999', ...patch })).status
  assert.equal(await bad({ id: '' }), 400, 'truck id required')
  assert.equal(await bad({ id: 'TRK 5!' }), 400, 'truck id characters')
  assert.equal(await bad({ plateNumber: '' }), 400, 'plate required')
  assert.equal(await bad({ type: '' }), 400, 'type required')
  assert.equal(await bad({ capacityTons: 0 }), 400, 'capacity required')
  assert.equal(await bad({ fuel: undefined }), 400, 'fuel required')
  assert.equal(await bad({ year: 1900 }), 400, 'year range')
  assert.equal(await bad({ odometerKm: -5 }), 400, 'odometer range')
  assert.equal(await bad({ status: 'delayed' }), 400, 'reserve truck cannot be Delayed')
  assert.equal(await bad({ nextServiceDate: '2026-13-40' }), 400, 'next service date')
  const s = await state(adm)
  assert.ok(!s.reserveTrucks.some((t) => t.id === 'TRK-50'), 'nothing saved')
})

test('Add Truck refuses duplicate truck IDs and plate numbers', async () => {
  const adm = await admin()
  assert.equal((await act(adm, 'truck/add', { ...NEW_TRUCK, plateNumber: 'NEW 1' })).status, 409, 'same id')
  assert.equal((await act(adm, 'truck/add', { ...NEW_TRUCK, id: 'trk-01', plateNumber: 'NEW 1' })).status, 409, 'id differs only in case')
  assert.equal((await act(adm, 'truck/add', { ...NEW_TRUCK, id: 'TRK-09', plateNumber: 'abc1024' })).status, 409, 'service truck plate, other format')
  assert.equal((await act(adm, 'truck/add', { ...NEW_TRUCK, id: 'TRK-09', plateNumber: 'NBC-2087' })).status, 409, 'reserve truck plate')
  assert.equal((await state(adm)).reserveTrucks.length, 1)
})

test('only the admin can add, edit or delete trucks', async () => {
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  const res = await login('resident', 'maria.santos@email.com', 'resident123')
  for (const token of [drv, res]) {
    assert.equal((await act(token, 'truck/add', { ...NEW_TRUCK, id: 'TRK-77', plateNumber: 'DRV 77' })).status, 403)
    assert.equal((await act(token, 'truck/delete', { id: 'TRK-02' })).status, 403)
    assert.equal((await act(token, 'truck/setService', { id: 'TRK-02' })).status, 403)
  }
  const ds = await state(drv)
  assert.equal(ds.reserveTrucks, undefined, 'drivers only get the service truck')
})

test('edit a reserve truck; status changes; plate stays unique', async () => {
  const adm = await admin()
  const edit = (patch) => act(adm, 'truck/update', { ...NEW_TRUCK, ...patch })
  assert.equal((await edit({ plateNumber: 'ABC-1024' })).status, 409, "cannot take the service truck's plate")
  assert.equal((await edit({ status: 'standby' })).status, 400, 'reserve statuses only')
  assert.equal((await act(adm, 'truck/update', { ...NEW_TRUCK, id: 'TRK-404' })).status, 404)
  const r = await edit({ plateNumber: 'NBC 2088', year: 2020, model: 'Hino 300 Series', capacityTons: 6.5, status: 'maintenance' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const s = await state(adm)
  const t = s.reserveTrucks.find((x) => x.id === 'TRK-02')
  assert.equal(t.plateNumber, 'NBC 2088')
  assert.equal(t.model, '2020 Hino 300 Series')
  assert.equal(t.capacityTons, 6.5)
  assert.equal(t.status, 'maintenance')
  assert.equal(s.truck.status, 'active', 'service truck not touched')
})

test('service truck Inactive: the route cannot start', async () => {
  const adm = await admin()
  const svc = { plateNumber: 'ABC-1024', type: 'Mini Compactor', fuel: 'Diesel Euro-4', capacityTons: 5 }
  assert.equal((await act(adm, 'truck/update', { ...svc, status: 'inactive' })).status, 200)
  const r = await act(adm, 'run/start', {})
  assert.equal(r.status, 409)
  assert.match(r.json.error, /inactive/)
  assert.equal((await act(adm, 'truck/update', { ...svc, status: 'active' })).status, 200)
  assert.equal((await state(adm)).truck.model, '2022 Isuzu Elf N-Series', 'model kept when the old form sends none')
})

test('log maintenance on a reserve truck', async () => {
  const adm = await admin()
  const r = await act(adm, 'truck/logMaintenance', {
    truckId: 'TRK-02',
    type: 'Brake Pad Replacement',
    odometerKm: 1500,
    date: '2026-10-27',
    newStatus: 'active',
    nextServiceDate: '2027-01-15',
    notes: 'Front pads',
  })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal((await act(adm, 'truck/logMaintenance', { truckId: 'TRK-02', type: 'Brake Pad Replacement', odometerKm: 10, date: '2026-10-27', newStatus: 'active' })).status, 400, 'odometer cannot go back')
  const s = await state(adm)
  const t = s.reserveTrucks.find((x) => x.id === 'TRK-02')
  assert.equal(t.maintenance[0].type, 'Brake Pad Replacement')
  assert.equal(t.odometerKm, 1500)
  assert.equal(t.status, 'active')
  assert.equal(t.nextServiceDate, '2027-01-15')
  assert.equal(s.truck.maintenance.length, 1, 'service truck history unchanged')
})

test('make a reserve truck the service truck: driver, roster and route move with it', async () => {
  const adm = await admin()
  const before = await state(adm)
  const roster = before.drivers.filter((d) => d.truckId === 'TRK-01').map((d) => d.id)
  assert.ok(roster.length > 0)

  await act(adm, 'truck/add', { ...NEW_TRUCK, id: 'TRK-03', plateNumber: 'OFF 333', status: 'inactive' })
  assert.equal((await act(adm, 'truck/setService', { id: 'TRK-03' })).status, 409, 'must be Active')
  assert.equal((await act(adm, 'truck/setService', { id: 'TRK-01' })).status, 409, 'already the service truck')

  const r = await act(adm, 'truck/setService', { id: 'TRK-02' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const s = await state(adm)
  assert.equal(s.truck.id, 'TRK-02')
  assert.equal(s.truck.driverId, before.truck.driverId, 'driver on duty moved')
  assert.equal(s.truck.routeId, s.route.id)
  assert.equal(s.route.truckId, 'TRK-02')
  assert.deepEqual(s.drivers.filter((d) => d.truckId === 'TRK-02').map((d) => d.id), roster, 'shift drivers moved')
  assert.ok(!s.drivers.some((d) => d.truckId === 'TRK-01'))
  const old = s.reserveTrucks.find((t) => t.id === 'TRK-01')
  assert.equal(old.driverId, null)
  assert.equal(old.routeId, null)
  assert.equal(old.maintenance.length, 1, 'history kept')

  // The driver still drives (now TRK-02) and sees it in their app.
  const drv = await login('driver', 'driver.ortiz@cleantrack.ph', 'driver123')
  assert.equal((await state(drv)).truck.id, 'TRK-02')
})

test('delete refuses the service truck and trucks with run history', async () => {
  const adm = await admin()
  // Service truck cannot be deleted.
  let r = await act(adm, 'truck/delete', { id: 'TRK-02' })
  assert.equal(r.status, 409)
  assert.match(r.json.error, /service truck/)

  // A run made with TRK-02, then TRK-01 takes the route back: TRK-02 keeps run history.
  assert.equal((await act(adm, 'run/start', {})).status, 200)
  assert.equal((await act(adm, 'truck/setService', { id: 'TRK-01' })).status, 409, 'not during a route')
  assert.equal((await act(adm, 'run/end', {})).status, 200)
  assert.equal((await act(adm, 'truck/setService', { id: 'TRK-01' })).status, 200)
  r = await act(adm, 'truck/delete', { id: 'TRK-02' })
  assert.equal(r.status, 409)
  assert.match(r.json.error, /collection run/)

  // A reserve truck with no dependents can be deleted (with its maintenance).
  assert.equal((await act(adm, 'truck/delete', { id: 'TRK-03' })).status, 200)
  assert.equal((await act(adm, 'truck/delete', { id: 'TRK-03' })).status, 404)
  const s = await state(adm)
  assert.deepEqual(s.reserveTrucks.map((t) => t.id), ['TRK-02'])
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM maintenance_records WHERE truck_id = 'TRK-03'").get().n, 0)
})

test('trucks are saved in the database and survive a server restart', async () => {
  const adm = await admin()
  const before = await state(adm)
  await stopServer()
  await startServer()
  const adm2 = await admin()
  const s = await state(adm2)
  assert.equal(s.truck.id, before.truck.id)
  assert.deepEqual(s.reserveTrucks, before.reserveTrucks)
  assert.deepEqual(
    s.drivers.map((d) => [d.id, d.truckId]),
    before.drivers.map((d) => [d.id, d.truckId]),
  )
})

test('reducer: delete block reasons and older data without reserveTrucks', () => {
  const s = createInitialData()
  delete s.reserveTrucks // data saved before this feature
  assert.match(truckDeleteBlock(s, s.truck), /service truck/)
  const added = dataReducer(s, { type: 'truck/add', payload: { ...NEW_TRUCK, model: '2021 Hino 300' } })
  assert.equal(added.reserveTrucks.length, 1)
  const t = added.reserveTrucks[0]
  assert.equal(truckDeleteBlock(added, t), null)
  assert.match(truckDeleteBlock({ ...added, runs: [{ truckId: 'TRK-02' }] }, t), /collection run/)
  assert.match(truckDeleteBlock({ ...added, crew: [{ truckId: 'TRK-02' }] }, t), /collector/)
  // Updating with no id still edits the service truck.
  assert.equal(dataReducer(added, { type: 'truck/update', payload: { status: 'standby' } }).truck.status, 'standby')
})
