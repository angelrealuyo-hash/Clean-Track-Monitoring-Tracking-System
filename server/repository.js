// Converts between the database tables and the app's data object (the same
// shape the screens and src/store/dataReducer.js use). The data is small (one
// barangay, a few trucks), so saving rewrites the changed tables inside one
// transaction, which keeps every save all-or-nothing.
import { transaction } from './db.js'
import { normalizeSchedule } from '../src/data/schedule.js'
import { IDLE_CONTROL } from '../src/services/trackingSimulation.js'
import { primaryTruckId, sessionOf, withLegacy } from '../src/store/fleet.js'

const json = (v) => (v === undefined || v === null ? null : JSON.stringify(v))
const parse = (v, fallback = null) => (v ? JSON.parse(v) : fallback)
const bool = (v) => Boolean(v)

export function hasData(db) {
  return Boolean(db.prepare("SELECT value FROM meta WHERE key = 'seeded_at'").get())
}

export function loadState(db) {
  const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]))
  const settings = Object.fromEntries(db.prepare('SELECT key, value_json FROM settings').all().map((r) => [r.key, JSON.parse(r.value_json)]))

  // Every registered truck, each with its own route (route_id) and driver on duty.
  const maintenanceOf = db.prepare('SELECT * FROM maintenance_records WHERE truck_id = ? ORDER BY seq')
  const truckRows = db.prepare('SELECT * FROM trucks ORDER BY rowid').all().map((t) => ({
    id: t.id,
    plateNumber: t.plate_number,
    type: t.type,
    model: t.model ?? '',
    capacityTons: t.capacity_tons,
    fuel: t.fuel,
    odometerKm: t.odometer_km,
    driverId: t.driver_id,
    routeId: t.route_id,
    status: t.status,
    maintenance: maintenanceOf.all(t.id).map((m) => ({
      date: m.date,
      type: m.type,
      ...(m.odometer_km !== null ? { odometerKm: m.odometer_km } : {}),
      notes: m.notes ?? '',
    })),
    nextServiceDate: t.next_service_date,
  }))
  const trucks = truckRows

  const accounts = db.prepare("SELECT ref_id, active FROM accounts WHERE role = 'driver'").all()
  const accountOf = Object.fromEntries(accounts.map((a) => [a.ref_id, a.active]))
  const drivers = db.prepare('SELECT * FROM drivers ORDER BY id').all().map((d) => ({
    id: d.id,
    name: d.name,
    initials: d.initials,
    phone: d.phone,
    ...(d.email ? { email: d.email } : {}),
    license: d.license,
    truckId: d.truck_id ?? null,
    shift: d.shift || null, // 'morning' | 'afternoon' | null
    active: d.active !== 0,
    status: d.status,
    photo: d.photo ?? null,
    // 'active' | 'disabled' | 'none' (no sign-in account yet)
    account: d.id in accountOf ? (accountOf[d.id] ? 'active' : 'disabled') : 'none',
  }))

  // Every collection route with its stops, in the order they were added.
  const stopsOf = db.prepare('SELECT * FROM route_stops WHERE route_id = ? ORDER BY seq')
  const routes = db.prepare('SELECT * FROM routes ORDER BY rowid').all().map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.short_name,
    coordinatesVerified: bool(r.coordinates_verified),
    startTime: r.start_time,
    stops: stopsOf.all(r.id).map((s) => ({
      id: s.id,
      name: s.name,
      purok: s.purok,
      coords: [s.lat, s.lng],
      households: s.households,
    })),
  }))

  // One session per truck: its demo GPS controls and its route run in progress
  // (migration 009). A truck without a row is idle.
  const sessionRows = Object.fromEntries(db.prepare('SELECT * FROM truck_sessions').all().map((x) => [x.truck_id, x]))
  const sessions = Object.fromEntries(
    trucks.map((t) => {
      const x = sessionRows[t.id]
      return [
        t.id,
        x
          ? { simulation: { status: x.sim_status, startedAt: x.started_at, pausedAt: x.paused_at, stoppedAt: x.stopped_at, pausedMs: x.paused_ms }, activeRunId: x.active_run_id || null }
          : { simulation: { ...IDLE_CONTROL }, activeRunId: null },
      ]
    }),
  )

  // The official days (Mon/Wed/Fri) always apply, whatever older rows say.
  const weeklySchedule = normalizeSchedule(db.prepare('SELECT * FROM schedules ORDER BY seq').all().map((d) => ({ day: d.day, wasteType: d.waste_type, window: d.time_window })))

  const residents = db.prepare('SELECT * FROM residents ORDER BY created_at, id').all().map((x) => ({
    id: x.id,
    email: x.email ?? '',
    name: x.name,
    initials: x.initials,
    phone: x.phone,
    address: x.address,
    purok: x.purok,
    householdId: x.household_id,
    prefs: parse(x.prefs_json, {}),
    createdAt: x.created_at,
    photo: x.photo ?? null,
  }))

  const historyRows = db.prepare('SELECT * FROM report_history ORDER BY report_id, seq').all()
  const reports = db.prepare('SELECT * FROM reports ORDER BY submitted_at DESC').all().map((x) => ({
    id: x.id,
    residentId: x.resident_id,
    residentName: x.resident_name,
    residentPhone: x.resident_phone,
    category: x.category,
    location: x.location,
    description: x.description ?? '',
    photo: x.photo,
    smsUpdates: bool(x.sms_updates),
    status: x.status,
    submittedAt: x.submitted_at,
    adminResponse: x.admin_response,
    history: historyRows.filter((h) => h.report_id === x.id).map((h) => ({ at: h.at, text: h.text })),
  }))

  const reads = db.prepare('SELECT notification_id, user_key FROM notification_reads').all()
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY time DESC, id DESC').all().map((n) => {
    const readBy = reads.filter((x) => x.notification_id === n.id).map((x) => x.user_key)
    return {
      id: n.id,
      audience: n.audience,
      priority: n.priority,
      title: n.title,
      body: n.body,
      time: n.time,
      ...(n.zone ? { zone: n.zone } : {}),
      ...(n.kind ? { kind: n.kind } : {}),
      ...(n.key ? { key: n.key } : {}),
      ...(n.resident_id ? { residentId: n.resident_id } : {}),
      ...(n.truck_id ? { truckId: n.truck_id } : {}),
      ...(n.link_json ? { link: JSON.parse(n.link_json) } : {}),
      ...(n.photo ? { photo: n.photo } : {}),
      readBy,
    }
  })

  const broadcasts = db.prepare('SELECT * FROM broadcasts ORDER BY sent_at DESC').all().map((b) => ({
    id: b.id,
    zone: b.zone,
    subject: b.subject,
    message: b.message ?? '',
    channels: parse(b.channels_json, ['App']),
    sentAt: b.sent_at,
  }))

  const records = db.prepare('SELECT * FROM collection_records').all()
  const runs = db.prepare('SELECT * FROM collection_runs ORDER BY started_at DESC').all().map((x) => ({
    id: x.id,
    date: x.date,
    status: x.status,
    startedAt: x.started_at,
    endedAt: x.ended_at,
    startedBy: x.started_by,
    truckId: x.truck_id,
    driverId: x.driver_id,
    driverName: x.driver_name,
    routeId: x.route_id,
    routeName: x.route_name,
    stops: parse(x.stops_json, []),
    special: Boolean(x.special),
    results: Object.fromEntries(
      records
        .filter((c) => c.run_id === x.id)
        .map((c) => [
          c.stop_id,
          { status: c.status, note: c.note ?? '', at: c.recorded_at, by: c.recorded_by, byName: c.recorded_by_name ?? '', bags: c.bags, simAt: c.sim_at },
        ]),
    ),
  }))

  const nullableBool = (v) => (v === null || v === undefined ? null : Boolean(v))
  const collectionFeedback = db.prepare('SELECT * FROM collection_feedback ORDER BY date DESC, updated_at DESC').all().map((f) => ({
    id: f.id,
    residentId: f.resident_id,
    residentName: f.resident_name ?? '',
    purok: f.purok ?? '',
    date: f.date,
    runId: f.run_id,
    willDispose: Boolean(f.will_dispose),
    truckPassed: nullableBool(f.truck_passed),
    disposed: nullableBool(f.disposed),
    reason: f.reason,
    reasonText: f.reason_text ?? '',
    reportId: f.report_id,
    submittedAt: f.submitted_at,
    updatedAt: f.updated_at,
  }))

  const driverIssues = db.prepare('SELECT * FROM driver_issues ORDER BY reported_at DESC, id DESC').all().map((x) => ({
    id: x.id,
    reportedAt: x.reported_at,
    driverId: x.driver_id,
    driverName: x.driver_name ?? '',
    runId: x.run_id,
    truckId: x.truck_id ?? null,
    stopId: x.stop_id,
    stopName: x.stop_name,
    issueType: x.issue_type,
    issueLabel: x.issue_label,
    description: x.description,
    photo: x.photo,
    notifiedOffice: Boolean(x.notified_office),
    markedMissed: Boolean(x.marked_missed),
  }))

  const crew = db.prepare('SELECT * FROM crew_members ORDER BY created_at, id').all().map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    phone: c.phone ?? '',
    truckId: c.truck_id,
    shift: c.shift ?? null,
    status: c.status,
    photo: c.photo ?? null,
    createdAt: c.created_at,
  }))

  const scheduleExceptions = db.prepare('SELECT * FROM schedule_exceptions ORDER BY date').all().map((x) => ({ date: x.date, kind: x.kind, reason: x.reason, createdAt: x.created_at }))

  return withLegacy({
    version: Number(meta.data_version ?? 0),
    trucks,
    routes,
    drivers,
    weeklySchedule,
    scheduleExceptions,
    residents,
    reports,
    notifications,
    broadcasts,
    runs,
    collectionFeedback,
    driverIssues,
    crew,
    sessions,
    adminPhoto: meta.admin_photo || null,
    settings,
    savedAt: meta.saved_at ?? null,
  })
}

// Saves the whole data object. Tables are rewritten in one transaction.
// Only the multi-truck data is saved (trucks, routes, sessions); the
// single-truck fields older screens read are derived again when loading.
export function saveState(db, state) {
  // The first truck with a route is mirrored into the pre-009 single-truck
  // places (meta.active_run_id, simulation_state), so older code still finds
  // consistent data after a rollback.
  const legacyTruckId = primaryTruckId(state)
  const legacy = legacyTruckId ? sessionOf(state, legacyTruckId) : { simulation: IDLE_CONTROL, activeRunId: null }
  transaction(db, () => {
    const setMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    setMeta.run('data_version', String((state.version ?? 0) + 1))
    setMeta.run('active_run_id', legacy.activeRunId ?? '')
    setMeta.run('saved_at', new Date().toISOString())
    setMeta.run('admin_photo', state.adminPhoto ?? '')

    db.exec('DELETE FROM settings')
    const setSetting = db.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?)')
    for (const [k, v] of Object.entries(state.settings)) setSetting.run(k, JSON.stringify(v))

    db.exec('DELETE FROM trucks; DELETE FROM maintenance_records;')
    const addTruck = db.prepare(
      'INSERT INTO trucks (id, plate_number, type, model, capacity_tons, fuel, odometer_km, driver_id, route_id, status, next_service_date) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    const addMaint = db.prepare('INSERT INTO maintenance_records (truck_id, seq, date, type, odometer_km, notes) VALUES (?,?,?,?,?,?)')
    for (const t of state.trucks) {
      addTruck.run(t.id, t.plateNumber, t.type, t.model ?? '', t.capacityTons ?? null, t.fuel ?? null, t.odometerKm ?? null, t.driverId ?? null, t.routeId ?? null, t.status, t.nextServiceDate ?? null)
      ;(t.maintenance ?? []).forEach((m, i) => addMaint.run(t.id, i, m.date, m.type, m.odometerKm ?? null, m.notes ?? ''))
    }

    db.exec('DELETE FROM truck_sessions')
    const addSession = db.prepare(
      'INSERT INTO truck_sessions (truck_id, sim_status, started_at, paused_at, stopped_at, paused_ms, active_run_id) VALUES (?,?,?,?,?,?,?)',
    )
    for (const t of state.trucks) {
      const { simulation: c = IDLE_CONTROL, activeRunId } = sessionOf(state, t.id)
      addSession.run(t.id, c.status ?? 'idle', c.startedAt ?? null, c.pausedAt ?? null, c.stoppedAt ?? null, Math.round(c.pausedMs || 0), activeRunId ?? null)
    }

    db.exec('DELETE FROM drivers')
    const addDriver = db.prepare('INSERT INTO drivers (id, name, initials, phone, email, license, shift, status, photo, truck_id, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    for (const d of state.drivers)
      addDriver.run(d.id, d.name, d.initials ?? '', d.phone ?? '', d.email ?? null, d.license ?? '', d.shift ?? null, d.status, d.photo ?? null, d.truckId ?? null, d.active === false ? 0 : 1)

    db.exec('DELETE FROM routes; DELETE FROM route_stops;')
    const addRoute = db.prepare('INSERT INTO routes (id, name, short_name, start_time, coordinates_verified) VALUES (?,?,?,?,?)')
    const addStop = db.prepare('INSERT INTO route_stops (id, route_id, seq, name, purok, households, lat, lng) VALUES (?,?,?,?,?,?,?,?)')
    for (const r of state.routes) {
      addRoute.run(r.id, r.name, r.shortName ?? '', r.startTime ?? '', r.coordinatesVerified ? 1 : 0)
      r.stops.forEach((s, i) => addStop.run(s.id, r.id, i, s.name, s.purok, s.households, s.coords[0], s.coords[1]))
    }

    db.exec('DELETE FROM schedules')
    const addDay = db.prepare('INSERT INTO schedules (day, seq, waste_type, time_window) VALUES (?,?,?,?)')
    state.weeklySchedule.forEach((d, i) => addDay.run(d.day, i, d.wasteType, d.window))

    db.exec('DELETE FROM schedule_exceptions')
    const addException = db.prepare('INSERT INTO schedule_exceptions (date, kind, reason, created_at) VALUES (?,?,?,?)')
    for (const x of state.scheduleExceptions ?? []) addException.run(x.date, x.kind, x.reason, x.createdAt)

    db.exec('DELETE FROM residents')
    const addResident = db.prepare(
      'INSERT INTO residents (id, name, initials, email, phone, address, purok, household_id, prefs_json, created_at, photo) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    for (const x of state.residents)
      addResident.run(x.id, x.name, x.initials ?? '', x.email || null, x.phone ?? '', x.address ?? '', x.purok ?? '', x.householdId ?? '', json(x.prefs ?? {}), x.createdAt ?? null, x.photo ?? null)

    db.exec('DELETE FROM reports; DELETE FROM report_history;')
    const addReport = db.prepare(
      'INSERT INTO reports (id, resident_id, resident_name, resident_phone, category, location, description, photo, sms_updates, status, submitted_at, admin_response) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    const addHistory = db.prepare('INSERT INTO report_history (report_id, seq, at, text) VALUES (?,?,?,?)')
    for (const x of state.reports) {
      addReport.run(x.id, x.residentId, x.residentName ?? '', x.residentPhone ?? null, x.category, x.location, x.description ?? '', x.photo ?? null, x.smsUpdates ? 1 : 0, x.status, x.submittedAt, x.adminResponse ?? null)
      ;(x.history ?? []).forEach((h, i) => addHistory.run(x.id, i, h.at, h.text))
    }

    db.exec('DELETE FROM notifications; DELETE FROM notification_reads;')
    const addNote = db.prepare(
      'INSERT INTO notifications (id, audience, priority, title, body, time, zone, kind, key, resident_id, link_json, photo, truck_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    const addRead = db.prepare('INSERT INTO notification_reads (notification_id, user_key) VALUES (?,?)')
    for (const n of state.notifications) {
      addNote.run(n.id, n.audience, n.priority ?? 'low', n.title, n.body ?? '', n.time, n.zone ?? null, n.kind ?? null, n.key ?? null, n.residentId ?? null, json(n.link), n.photo ?? null, n.truckId ?? null)
      for (const k of new Set(n.readBy ?? [])) addRead.run(n.id, k)
    }

    db.exec('DELETE FROM broadcasts')
    const addBroadcast = db.prepare('INSERT INTO broadcasts (id, zone, subject, message, channels_json, sent_at) VALUES (?,?,?,?,?,?)')
    for (const b of state.broadcasts) addBroadcast.run(b.id, b.zone, b.subject, b.message ?? '', json(b.channels ?? ['App']), b.sentAt)

    db.exec('DELETE FROM collection_runs; DELETE FROM collection_records;')
    const addRun = db.prepare(
      'INSERT INTO collection_runs (id, date, status, started_at, ended_at, started_by, truck_id, driver_id, driver_name, route_id, route_name, stops_json, special) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    const addRecord = db.prepare(
      'INSERT INTO collection_records (run_id, stop_id, status, note, recorded_at, recorded_by, recorded_by_name, bags, sim_at) VALUES (?,?,?,?,?,?,?,?,?)',
    )
    for (const x of state.runs) {
      addRun.run(x.id, x.date, x.status, x.startedAt, x.endedAt ?? null, x.startedBy, x.truckId ?? null, x.driverId ?? null, x.driverName ?? '', x.routeId ?? null, x.routeName ?? '', json(x.stops), x.special ? 1 : 0)
      for (const [stopId, c] of Object.entries(x.results))
        addRecord.run(x.id, stopId, c.status, c.note ?? '', c.at, c.by, c.byName ?? '', Number.isFinite(c.bags) ? c.bags : null, Number.isFinite(c.simAt) ? Math.round(c.simAt) : null)
    }

    const bit = (v) => (v === null || v === undefined ? null : v ? 1 : 0)
    db.exec('DELETE FROM collection_feedback')
    const addFeedback = db.prepare(
      'INSERT INTO collection_feedback (id, resident_id, resident_name, purok, date, run_id, will_dispose, truck_passed, disposed, reason, reason_text, report_id, submitted_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    for (const f of state.collectionFeedback ?? [])
      addFeedback.run(f.id, f.residentId, f.residentName ?? '', f.purok ?? '', f.date, f.runId ?? null, f.willDispose ? 1 : 0, bit(f.truckPassed), bit(f.disposed), f.reason ?? null, f.reasonText ?? '', f.reportId ?? null, f.submittedAt, f.updatedAt)

    db.exec('DELETE FROM driver_issues')
    const addIssue = db.prepare(
      'INSERT INTO driver_issues (id, reported_at, driver_id, driver_name, run_id, stop_id, stop_name, issue_type, issue_label, description, photo, notified_office, marked_missed, truck_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    for (const x of state.driverIssues ?? [])
      addIssue.run(x.id, x.reportedAt, x.driverId ?? null, x.driverName ?? '', x.runId ?? null, x.stopId ?? null, x.stopName ?? null, x.issueType, x.issueLabel, x.description, x.photo ?? null, x.notifiedOffice ? 1 : 0, x.markedMissed ? 1 : 0, x.truckId ?? null)

    db.exec('DELETE FROM crew_members')
    const addCrew = db.prepare('INSERT INTO crew_members (id, name, role, phone, truck_id, status, created_at, photo, shift) VALUES (?,?,?,?,?,?,?,?,?)')
    for (const c of state.crew ?? []) addCrew.run(c.id, c.name, c.role, c.phone || null, c.truckId ?? null, c.status, c.createdAt, c.photo ?? null, c.shift ?? null)

    const sim = legacy.simulation ?? IDLE_CONTROL
    db.prepare(
      'INSERT INTO simulation_state (id, status, started_at, paused_at, stopped_at, paused_ms) VALUES (1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status = excluded.status, started_at = excluded.started_at, paused_at = excluded.paused_at, stopped_at = excluded.stopped_at, paused_ms = excluded.paused_ms',
    ).run(sim.status, sim.startedAt ?? null, sim.pausedAt ?? null, sim.stoppedAt ?? null, Math.round(sim.pausedMs || 0))
  })
}

// ---------- Accounts ----------
export function findAccount(db, role, identifier) {
  return db.prepare('SELECT * FROM accounts WHERE role = ? AND (email = ? OR phone = ?) LIMIT 1').get(role, identifier, identifier)
}

export function getAccountByRef(db, role, refId) {
  return db.prepare('SELECT * FROM accounts WHERE role = ? AND ref_id = ? LIMIT 1').get(role, refId)
}

export function insertAccount(db, { id, role, refId, email, phone, passwordHash, active = true }) {
  db.prepare('INSERT INTO accounts (id, role, ref_id, email, phone, password_hash, active, created_at) VALUES (?,?,?,?,?,?,?,?)').run(
    id,
    role,
    refId,
    email || null,
    phone || null,
    passwordHash,
    active ? 1 : 0,
    new Date().toISOString(),
  )
}

export function updateAccount(db, role, refId, fields) {
  const sets = []
  const values = []
  for (const [col, v] of Object.entries(fields)) {
    sets.push(`${col} = ?`)
    values.push(v)
  }
  if (!sets.length) return
  db.prepare(`UPDATE accounts SET ${sets.join(', ')} WHERE role = ? AND ref_id = ?`).run(...values, role, refId)
}

// ---------- Location history (simulated) ----------
export function logLocation(db, { lat, lng, status, runId, event, truckId }) {
  db.prepare('INSERT INTO location_history (recorded_at, lat, lng, status, source, run_id, event, truck_id) VALUES (?,?,?,?,?,?,?,?)').run(
    new Date().toISOString(),
    lat,
    lng,
    status ?? null,
    'SIMULATED',
    runId ?? null,
    event ?? null,
    truckId ?? null,
  )
}

// Newest first; optionally for one truck.
export function recentLocations(db, limit = 20, truckId = null) {
  if (truckId) return db.prepare('SELECT * FROM location_history WHERE truck_id = ? ORDER BY id DESC LIMIT ?').all(truckId, limit)
  return db.prepare('SELECT * FROM location_history ORDER BY id DESC LIMIT ?').all(limit)
}
