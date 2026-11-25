// Migration 009 (multiple trucks) on a database in the pre-009 shape:
// every existing record is kept, the single GPS session and route run move to
// the truck on the route, and the app loads and saves the result unchanged.
// Run with: npm test   (uses temporary database files)
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../server/db.js'
import { loadState, saveState } from '../server/repository.js'
import { withoutLegacy } from '../src/store/fleet.js'
import { normalizeSchedule } from '../src/data/schedule.js'

// node:sqlite rows have no prototype; compare them as plain objects.
const rows = (db, sql) => db.prepare(sql).all().map((r) => ({ ...r }))

const MIGRATIONS = join(import.meta.dirname, '../server/migrations')
const dir = mkdtempSync(join(tmpdir(), 'cleantrack-m009-'))
after(() => rmSync(dir, { recursive: true, force: true }))

// A database with migrations 001-008 only (what every existing install has).
function pre009Database(path) {
  const db = new DatabaseSync(path)
  db.exec('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < '009').sort()) {
    db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
    db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(file, '2026-10-26T00:00:00Z')
  }
  return db
}

// Data shaped like the real database: TRK-01 on route RT-01 with its driver
// and a running demo truck, plus three trucks without a route.
function addRealisticData(db, { withRoute = true } = {}) {
  db.exec(`
    INSERT INTO meta (key, value) VALUES ('seeded_at', '2026-10-26T06:28:23Z'), ('data_version', '325'),
      ('active_run_id', 'RUN-2026-10-28-01'), ('saved_at', '2026-11-24T13:10:27Z'), ('admin_photo', '');
    INSERT INTO settings (key, value_json) VALUES ('simulationIntervalMs', '1000'), ('autoProximityAlerts', 'true');
    INSERT INTO trucks (id, plate_number, type, model, capacity_tons, fuel, odometer_km, driver_id, route_id, status, next_service_date) VALUES
      ('TRK-01', 'ABC-1024', 'Mini Compactor', '2022 Isuzu Elf N-Series', 5, 'Diesel Euro-4', 24380, 'DRV-01', ${withRoute ? "'RT-01'" : 'NULL'}, 'active', '2024-06-25'),
      ('TRK-02', 'ABC-765', 'Mini Compactor', '', 10, 'Diesel Euro-4', 0, NULL, NULL, 'active', NULL),
      ('TRK-03', 'ABC-890', 'Mini Compactor', '', 2, 'Diesel Euro-4', 0, NULL, NULL, 'active', NULL),
      ('TRK-04', 'ABC-890123', 'Dump Truck', '', 4, 'Diesel Euro-4', 0, NULL, NULL, 'active', '2026-11-24');
    INSERT INTO maintenance_records (truck_id, seq, date, type, odometer_km, notes) VALUES ('TRK-01', 0, '2024-05-18', 'Routine Inspection & Oil Change', NULL, 'Cleared municipal safety inspection.');
    INSERT INTO drivers (id, name, initials, phone, email, license, shift, status, photo, truck_id, active) VALUES
      ('DRV-01', 'Carlos Ortiz', 'CO', '+63 917 555 0142', 'driver.ortiz@cleantrack.ph', 'Class 2', 'morning', 'on-shift', NULL, 'TRK-01', 1),
      ('DRV-02', 'Ramon Cruz', 'RC', '+63 917 555 0143', NULL, 'Class 2', 'afternoon', 'standby', NULL, 'TRK-01', 1);
    INSERT INTO routes (id, name, short_name, start_time, coordinates_verified) VALUES ('RT-01', 'Barangay Collection Route (demo)', 'Purok 1-6 Loop', '06:00 AM', 0);
    INSERT INTO route_stops (id, route_id, seq, name, purok, households, lat, lng) VALUES
      ('STP-01', 'RT-01', 0, 'Truck Depot (Start)', 'Depot', 0, 14.6, 120.9862),
      ('STP-02', 'RT-01', 1, 'Demo Stop 1', 'Purok 1', 30, 14.6012, 120.9871),
      ('STP-10', 'RT-01', 2, 'Truck Depot (End)', 'Depot', 0, 14.6, 120.9862);
    INSERT INTO residents (id, name, initials, email, phone, address, purok, household_id, prefs_json, created_at, photo) VALUES
      ('RES-402', 'Maria Santos', 'MS', 'maria.santos@email.com', '+63 917 555 0192', 'Lot 1', 'Purok 1', 'HH-1', '{}', '2024-09-01T08:00:00', NULL);
    INSERT INTO collection_runs (id, date, status, started_at, ended_at, started_by, truck_id, driver_id, driver_name, route_id, route_name, stops_json, special) VALUES
      ('RUN-2026-10-28-01', '2026-10-28', 'in-progress', '2026-10-28T06:00:00Z', NULL, 'driver', 'TRK-01', 'DRV-01', 'Carlos Ortiz', 'RT-01', 'Barangay Collection Route (demo)', '[{"id":"STP-02","name":"Demo Stop 1","purok":"Purok 1","households":30}]', 0);
    INSERT INTO collection_records (run_id, stop_id, status, note, recorded_at, recorded_by, recorded_by_name, bags, sim_at) VALUES
      ('RUN-2026-10-28-01', 'STP-02', 'collected', '', '2026-10-28T06:10:00Z', 'driver', 'Carlos Ortiz', NULL, 60000);
    INSERT INTO simulation_state (id, status, started_at, paused_at, stopped_at, paused_ms) VALUES (1, 'running', '2026-11-03T15:05:45.632Z', NULL, NULL, 744);
    INSERT INTO location_history (recorded_at, lat, lng, status, source, run_id, event) VALUES
      ('2026-11-03T15:06:00Z', 14.6, 120.9862, 'running', 'SIMULATED', NULL, 'sim/start'),
      ('2026-11-03T15:07:00Z', 14.6012, 120.9871, 'waiting', 'SIMULATED', NULL, 'arrived:STP-02');
    INSERT INTO driver_issues (id, reported_at, driver_id, driver_name, run_id, stop_id, stop_name, issue_type, issue_label, description, photo, notified_office, marked_missed) VALUES
      ('ISS-001', '2026-10-28T06:20:00Z', 'DRV-01', 'Carlos Ortiz', 'RUN-2026-10-28-01', NULL, NULL, 'other', 'Flat tire', 'Front tire is flat.', NULL, 1, 0);
    INSERT INTO notifications (id, audience, priority, title, body, time, zone, kind, key, resident_id, link_json, photo) VALUES
      ('N-001', 'resident', 'high', 'The garbage truck is coming', 'On its way.', '2026-11-03T15:06:00Z', 'Purok 1', 'proximity', 'near-2026-11-03T15:05:45.632Z-Purok 1', NULL, NULL, NULL),
      ('N-002', 'admin', 'medium', 'New resident report', 'x', '2026-11-03T15:06:00Z', NULL, NULL, NULL, NULL, NULL, NULL);
    INSERT INTO notification_reads (notification_id, user_key) VALUES ('N-002', 'ADMIN');
    INSERT INTO accounts (id, role, ref_id, email, phone, password_hash, active, created_at) VALUES ('ACC-ADMIN', 'admin', 'ADMIN', 'admin@x', NULL, 'h', 1, '2026-10-26');
  `)
  // The full weekly schedule, as the app saves it (all seven days).
  const addDay = db.prepare('INSERT INTO schedules (day, seq, waste_type, time_window) VALUES (?,?,?,?)')
  normalizeSchedule().forEach((d, i) => addDay.run(d.day, i, d.wasteType, d.window))
}

// Every table's ORIGINAL columns, as row hashes (new columns are ignored).
function fingerprint(db) {
  const out = {}
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()) {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name)
    const all = db.prepare(`SELECT * FROM "${name}"`).all().map((r) => ({ ...r }))
    out[name] = { cols, n: all.length, rows: all }
  }
  return out
}
// Row ids that saving has always renumbered (rows are rewritten on every save;
// nothing refers to these numbers).
const AUTO_IDS = { maintenance_records: 'id', report_history: 'id' }

function sameOriginalData(db, before, { skip = [], afterSave = false } = {}) {
  for (const [table, b] of Object.entries(before)) {
    if (skip.includes(table)) continue
    const cols = afterSave ? b.cols.filter((c) => c !== AUTO_IDS[table]) : b.cols
    const hash = (rows) => createHash('sha256').update(rows.map((r) => JSON.stringify(cols.map((c) => r[c]))).sort().join('\n')).digest('hex')
    const now = db.prepare(`SELECT * FROM "${table}"`).all()
    assert.equal(now.length, b.n, `${table}: row count`)
    assert.equal(hash(now), hash(b.rows), `${table}: contents`)
  }
}

test('009 keeps every existing record and moves the single session to TRK-01', () => {
  const path = join(dir, 'real-shaped.db')
  const old = pre009Database(path)
  addRealisticData(old)
  const before = fingerprint(old)
  old.close()

  const db = openDatabase(path) // applies 009 only
  assert.deepEqual(
    rows(db, "SELECT name FROM schema_migrations WHERE name LIKE '009%'").map((r) => r.name),
    ['009_multi_truck.sql'],
  )
  sameOriginalData(db, before, { skip: ['schema_migrations'] })
  assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n, before.schema_migrations.n + 1)

  assert.deepEqual(rows(db, 'SELECT * FROM truck_sessions'), [
    { truck_id: 'TRK-01', sim_status: 'running', started_at: '2026-11-03T15:05:45.632Z', paused_at: null, stopped_at: null, paused_ms: 744, active_run_id: 'RUN-2026-10-28-01' },
  ])
  assert.deepEqual(rows(db, 'SELECT DISTINCT truck_id FROM location_history'), [{ truck_id: 'TRK-01' }])
  assert.deepEqual(rows(db, 'SELECT truck_id FROM driver_issues'), [{ truck_id: 'TRK-01' }])
  assert.deepEqual(rows(db, 'SELECT DISTINCT truck_id FROM notifications'), [{ truck_id: null }], 'old notifications are not about one truck')

  // The app reads the migrated data: four trucks, TRK-01 keeps everything.
  const s = loadState(db)
  assert.deepEqual(s.trucks.map((t) => [t.id, t.plateNumber, t.routeId, t.driverId]), [
    ['TRK-01', 'ABC-1024', 'RT-01', 'DRV-01'],
    ['TRK-02', 'ABC-765', null, null],
    ['TRK-03', 'ABC-890', null, null],
    ['TRK-04', 'ABC-890123', null, null],
  ])
  assert.equal(s.trucks[0].maintenance.length, 1)
  assert.equal(s.sessions['TRK-01'].activeRunId, 'RUN-2026-10-28-01')
  assert.equal(s.sessions['TRK-01'].simulation.status, 'running')
  for (const id of ['TRK-02', 'TRK-03', 'TRK-04']) assert.deepEqual(s.sessions[id], { simulation: { status: 'idle', startedAt: null, pausedAt: null, stoppedAt: null, pausedMs: 0 }, activeRunId: null })
  // Older screens: unchanged single-truck view.
  assert.equal(s.truck.id, 'TRK-01')
  assert.equal(s.route.id, 'RT-01')
  assert.equal(s.activeRunId, 'RUN-2026-10-28-01')
  assert.equal(s.simulation.pausedMs, 744)
  assert.equal(s.driverIssues[0].truckId, 'TRK-01')

  // Saving and loading again changes nothing (the save mirror keeps the
  // pre-009 single-truck rows in step for a rollback).
  saveState(db, s)
  const again = loadState(db)
  const { version: _v1, savedAt: _s1, ...a } = withoutLegacy(s)
  const { version: _v2, savedAt: _s2, ...b } = withoutLegacy(again)
  assert.deepEqual(b, a)
  sameOriginalData(db, before, { skip: ['schema_migrations', 'meta'], afterSave: true })
  assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'active_run_id'").get().value, 'RUN-2026-10-28-01')
  assert.equal(db.prepare('SELECT COUNT(*) n FROM truck_sessions').get().n, 4)
  db.close()

  // Opening again does not apply 009 a second time.
  const reopened = openDatabase(path)
  assert.equal(reopened.prepare("SELECT COUNT(*) n FROM schema_migrations WHERE name = '009_multi_truck.sql'").get().n, 1)
  reopened.close()
})

test('009 on a database where no truck has a route, and on an empty database', () => {
  const path = join(dir, 'no-route.db')
  const old = pre009Database(path)
  addRealisticData(old, { withRoute: false })
  const before = fingerprint(old)
  old.close()
  const db = openDatabase(path)
  sameOriginalData(db, before, { skip: ['schema_migrations'] })
  assert.equal(db.prepare('SELECT COUNT(*) n FROM truck_sessions').get().n, 0, 'no truck to carry the session to')
  assert.equal(db.prepare('SELECT COUNT(*) n FROM location_history WHERE truck_id IS NULL').get().n, 2, 'GPS points stay unassigned')
  db.close()

  const empty = openDatabase(join(dir, 'empty.db'))
  assert.equal(empty.prepare('SELECT COUNT(*) n FROM truck_sessions').get().n, 0)
  empty.close()
})
