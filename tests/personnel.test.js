// Truck 1 personnel limits: 1 Driver + 3 Crew Members per shift (8 in all).
// Run with: npm test
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import express from 'express'
import { openDatabase } from '../server/db.js'
import { createApi } from '../server/app.js'
import { loadState } from '../server/repository.js'
import { capacityOf, hasRoom } from '../src/data/personnel.js'

mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-28T09:00:00') })

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
let server, base, api, adm

before(async () => {
  api = createApi({ db: openDatabase(':memory:'), tickMs: 0 })
  const app = express()
  app.use('/api', api.router)
  await new Promise((r) => (server = app.listen(0, r)))
  base = `http://localhost:${server.address().port}/api`
  adm = (await call('/auth/login', { body: { role: 'admin', identifier: 'admin@cleantrack.gov', password: 'SuperAdmin#2025' } })).json.token
})
after(() => {
  api.close()
  server.close()
})

async function call(path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const send = (type, payload, token = adm) => call('/actions', { token, body: { type, payload } })
const saved = () => loadState(api.db) // what is in the database
const crewNamed = (name) => saved().crew.find((c) => c.name === name)
const addCrew = (name, shift, extra = {}) => send('crew/add', { name, role: 'Garbage Collector', shift, ...extra })

test('seed: one active driver per shift; both driver places are taken', () => {
  const cap = capacityOf(saved())
  assert.deepEqual([cap.shifts.morning.driver, cap.shifts.afternoon.driver, cap.drivers, cap.crew, cap.overall], [1, 1, 2, 0, 2])
})

test('only one active Morning and one active Afternoon driver', async () => {
  const juan = { name: 'Juan Dela Cruz', phone: '0918 222 3333', license: 'Class 2' }
  for (const shift of ['morning', 'afternoon']) {
    const r = await send('driver/add', { ...juan, shift })
    assert.equal(r.status, 409, `${shift} driver place is full`)
    assert.match(r.json.error, shift === 'morning' ? /Morning Shift Drivers: 1\/1/ : /Afternoon Shift Drivers: 1\/1/)
  }
  assert.equal((await send('driver/add', { ...juan })).status, 400, 'a shift is required')
  assert.equal((await send('driver/add', { ...juan, shift: 'night' })).status, 400, 'only Morning / Afternoon')
  // Inactive people take no place, so they can still be saved.
  const ok = await send('driver/add', { ...juan, shift: 'morning', active: false })
  assert.equal(ok.status, 200)
  const j = saved().drivers.find((d) => d.name === 'Juan Dela Cruz')
  assert.deepEqual([j.shift, j.truckId, j.active], ['morning', 'TRK-01', false])
  assert.equal(capacityOf(saved()).drivers, 2)
  // ...but cannot become active while the shift has its driver.
  assert.equal((await send('driver/update', { id: j.id, patch: { active: true } })).status, 409)
  // Moving into the occupied Afternoon place is refused too.
  assert.equal((await send('driver/update', { id: j.id, patch: { shift: 'afternoon', active: true } })).status, 409)
})

test('only three active crew per shift; 8 people in all', async () => {
  for (const n of ['Ana', 'Ben', 'Cris']) assert.equal((await addCrew(`${n} Morning`, 'morning')).status, 200)
  const fourth = await addCrew('Dan Morning', 'morning')
  assert.equal(fourth.status, 409)
  assert.match(fourth.json.error, /Morning Shift Crew: 3\/3/)
  for (const n of ['Ana', 'Ben', 'Cris']) assert.equal((await addCrew(`${n} Afternoon`, 'afternoon')).status, 200)
  const r = await addCrew('Dan Afternoon', 'afternoon')
  assert.equal(r.status, 409)
  assert.match(r.json.error, /Afternoon Shift Crew: 3\/3/)
  const cap = capacityOf(saved())
  assert.deepEqual([cap.drivers, cap.crew, cap.shiftTotal('morning'), cap.shiftTotal('afternoon'), cap.overall], [2, 6, 4, 4, 8])
  assert.equal(saved().crew.length, 6, 'refused people were not saved')
})

test('repeated and simultaneous submissions cannot pass the limit', async () => {
  // Free one morning place.
  const ana = crewNamed('Ana Morning')
  assert.equal((await send('crew/update', { id: ana.id, patch: { ...ana, status: 'inactive' } })).status, 200)
  assert.equal(capacityOf(saved()).shifts.morning.crew, 2)
  // Five different people sent at the same moment: only one gets the place.
  const results = await Promise.all(['Eli', 'Fe', 'Gil', 'Hana', 'Ivy'].map((n) => addCrew(`${n} Rush`, 'morning')))
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409, 409, 409, 409])
  assert.equal(capacityOf(saved()).shifts.morning.crew, 3)
  // The same form sent again: the same person is not listed twice.
  const again = await addCrew('Ben Morning', 'morning', { status: 'inactive' })
  assert.equal(again.status, 409)
  assert.match(again.json.error, /already on the collectors list/)
})

test('personal details can be edited while the shift is full', async () => {
  const ben = crewNamed('Ben Morning')
  assert.equal(capacityOf(saved()).shifts.morning.crew, 3, 'morning crew is full')
  const r = await send('crew/update', { id: ben.id, patch: { ...ben, name: 'Benjamin Morning', phone: '0917 555 0100', photo: PNG } })
  assert.equal(r.status, 200)
  const now = crewNamed('Benjamin Morning')
  assert.deepEqual([now.phone, now.shift, now.status], ['+63 917 555 0100', 'morning', 'active'])
  assert.match(now.photo, /^upl:/)
  // Drivers too, when both driver places are full.
  const carlos = saved().drivers.find((d) => d.id === 'DRV-01')
  const d = await send('driver/update', { id: 'DRV-01', patch: { name: carlos.name, phone: '0917 555 0142', license: carlos.license, shift: 'morning', active: true, email: carlos.email ?? '' } })
  assert.equal(d.status, 200)
})

test('reassigning a collector respects the limits and updates the counts', async () => {
  const cris = crewNamed('Cris Afternoon')
  // Morning is full: an afternoon crew member cannot move there.
  assert.equal((await send('crew/update', { id: cris.id, patch: { ...cris, shift: 'morning' } })).status, 409)
  // Free a morning place, then the move works.
  const rush = saved().crew.find((c) => c.name.endsWith('Rush'))
  await send('crew/update', { id: rush.id, patch: { ...rush, status: 'inactive' } })
  assert.equal((await send('crew/update', { id: cris.id, patch: { ...cris, shift: 'morning' } })).status, 200)
  const cap = capacityOf(saved())
  assert.deepEqual([cap.shifts.morning.crew, cap.shifts.afternoon.crew, cap.crew], [3, 2, 5])
  // Reactivating someone whose shift is now full is refused.
  const ana = crewNamed('Ana Morning')
  const back = await send('crew/update', { id: ana.id, patch: { ...ana, status: 'active' } })
  assert.equal(back.status, 409)
  // An inactive person may move to a shift with room and become active there.
  assert.equal((await send('crew/update', { id: ana.id, patch: { ...ana, shift: 'afternoon', status: 'active' } })).status, 200)
  assert.deepEqual([capacityOf(saved()).shifts.afternoon.crew, capacityOf(saved()).overall], [3, 8])
})

test('inactive drivers free their place; the driver on duty must hold a place', async () => {
  // DRV-02 (Afternoon) becomes inactive -> the afternoon driver place opens.
  assert.equal((await send('driver/update', { id: 'DRV-02', patch: { active: false } })).status, 200)
  assert.ok(hasRoom(saved(), 'driver', 'afternoon'))
  assert.equal((await send('truck/assignDriver', { driverId: 'DRV-02' })).status, 409, 'inactive driver cannot drive')
  const juan = saved().drivers.find((d) => d.name === 'Juan Dela Cruz')
  assert.equal((await send('driver/update', { id: juan.id, patch: { shift: 'afternoon', active: true } })).status, 200)
  assert.equal((await send('truck/assignDriver', { driverId: juan.id })).status, 200)
  // Making the driver on duty inactive also takes them off duty.
  assert.equal((await send('driver/update', { id: juan.id, patch: { active: false } })).status, 200)
  assert.equal(saved().truck.driverId, null)
  assert.equal((await send('truck/assignDriver', { driverId: 'DRV-01' })).status, 200)
})

test('database refuses over-limit rows even without the server rules', () => {
  const db = api.db
  const insertCrew = db.prepare("INSERT INTO crew_members (id, name, role, truck_id, status, created_at, shift) VALUES (?, ?, 'Garbage Collector', 'TRK-01', 'active', '2026-10-28', ?)")
  const full = (shift) => db.prepare("SELECT count(*) n FROM crew_members WHERE truck_id = 'TRK-01' AND status = 'active' AND shift = ?").get(shift).n
  assert.equal(full('morning'), 3)
  assert.throws(() => insertCrew.run('CRW-X1', 'Sneaky One', 'morning'), /PERSONNEL_SHIFT_FULL/)
  assert.throws(() => db.prepare("UPDATE crew_members SET status = 'active' WHERE name LIKE '% Rush'").run(), /PERSONNEL_SHIFT_FULL/)
  assert.throws(() => db.prepare("UPDATE drivers SET shift = 'morning', active = 1 WHERE name = 'Juan Dela Cruz'").run(), /UNIQUE/)
  assert.throws(() => db.prepare("UPDATE drivers SET shift = 'night' WHERE id = 'DRV-01'").run(), /PERSONNEL_INVALID_SHIFT/)
  assert.equal(full('morning'), 3, 'nothing changed')
})

test('migration keeps existing collectors and pictures and fits them into the limits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ct-mig-'))
  try {
    const path = join(dir, 'old.db')
    // A database as it was before migration 007.
    const old = new DatabaseSync(path)
    old.exec('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
    const migrations = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'migrations')
    for (const f of readdirSync(migrations).filter((x) => x.endsWith('.sql') && x < '007').sort()) {
      old.exec(readFileSync(join(migrations, f), 'utf8'))
      old.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(f, 'x')
    }
    old.exec("INSERT INTO trucks (id, plate_number, type, status, driver_id) VALUES ('TRK-01', 'ABC', 'Mini', 'active', 'DRV-03')")
    const d = old.prepare("INSERT INTO drivers (id, name, shift, status, photo) VALUES (?, ?, ?, 'standby', ?)")
    d.run('DRV-01', 'Morning One', 'Morning Shift (06:00 AM - 02:00 PM)', 'upl:aaa')
    d.run('DRV-02', 'Relief', 'Relief Driver', null)
    d.run('DRV-03', 'Truck Driver', 'Morning Shift (06:00 AM - 02:00 PM)', null)
    const c = old.prepare("INSERT INTO crew_members (id, name, role, truck_id, status, created_at, photo) VALUES (?, ?, 'Helper / Loader', ?, ?, ?, ?)")
    for (let i = 1; i <= 8; i++) c.run(`CRW-0${i}`, `Crew ${i}`, 'TRK-01', 'active', `2024-01-0${i}`, i === 8 ? 'upl:bbb' : null)
    c.run('CRW-09', 'Crew Off', 'TRK-01', 'inactive', '2024-02-01', null)
    old.close()

    const db = openDatabase(path)
    const drivers = Object.fromEntries(db.prepare('SELECT id, shift, truck_id, photo FROM drivers').all().map((r) => [r.id, r]))
    assert.equal(drivers['DRV-03'].shift, 'morning', "the truck's driver keeps the morning place")
    assert.equal(drivers['DRV-01'].shift, null, 'second morning driver taken off the roster (record kept)')
    assert.equal(drivers['DRV-01'].photo, 'upl:aaa')
    assert.equal(drivers['DRV-02'].shift, null, 'relief driver is not on a shift')
    assert.equal(db.prepare("SELECT driver_id FROM trucks").get().driver_id, 'DRV-03')
    const crew = db.prepare('SELECT id, shift, truck_id, status, photo FROM crew_members ORDER BY id').all()
    assert.equal(crew.length, 9, 'no record deleted')
    assert.deepEqual(crew.map((r) => r.shift), ['morning', 'morning', 'morning', 'afternoon', 'afternoon', 'afternoon', null, null, 'morning'])
    assert.equal(crew[7].photo, 'upl:bbb')
    assert.equal(crew[7].truck_id, null)
    db.close()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
