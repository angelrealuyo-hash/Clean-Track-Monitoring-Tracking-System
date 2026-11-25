// Every change to the demo data goes through here.
//
// Several trucks operate independently: the data keeps `trucks`, `routes` and
// one `sessions` entry per truck (GPS simulation + route run in progress); see
// src/store/fleet.js. Truck actions name their truck (`truckId`); an action
// without one applies to the focus truck (older screens).
import { todayISO } from '../utils/format.js'
import { IDLE_CONTROL, isCollectionStop, simElapsed } from '../services/trackingSimulation.js'
import { feedbackId } from '../data/collectionFeedback.js'
import { exceptionLabel, isPickupDate } from '../data/schedule.js'
import { RESERVE_STATUSES } from '../data/truck.js'
import { formatDate } from '../utils/format.js'
import {
  activeRunIdOf,
  currentRunOf,
  primaryTruckId,
  routeById,
  routeOfStop,
  routeOfTruck,
  routesOf,
  simulationOf,
  truckById,
  truckOfRoute,
  truckOfStop,
  trucksOf,
  updateRoute,
  updateTruck,
  withLegacy,
  withSession,
} from './fleet.js'

const now = () => new Date().toISOString()

export function nextId(prefix, items, width = 2) {
  const max = items.reduce((m, it) => {
    const n = Number(String(it.id).split('-').pop())
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return `${prefix}-${String(max + 1).padStart(width, '0')}`
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .slice(0, 2)
    .join('')
}

function markReadBy(n, userKey) {
  const readBy = n.readBy ?? []
  if (!userKey || readBy.includes(userKey)) return n
  return { ...n, readBy: [...readBy, userKey], read: true }
}

function addNotification(state, n) {
  const notification = {
    id: nextId('N', state.notifications, 3),
    readBy: [], // user keys that have read it (each person has their own read state)
    time: now(),
    priority: 'low',
    ...n,
  }
  return [notification, ...state.notifications]
}

// The truck an action without a truckId applies to: the focus truck (a
// driver's own truck, a resident's purok truck) or the first truck on a route.
const focusTruckId = (state) => (state.focusTruckId && truckById(state, state.focusTruckId) ? state.focusTruckId : primaryTruckId(state))
const truckIdFor = (state, id) => id ?? focusTruckId(state)
const defaultRouteId = (state) => routeOfTruck(state, focusTruckId(state))?.id ?? routesOf(state)[0]?.id ?? null

// Back to the depot, not started (after the truck's route changed).
const resetSim = (state, truckId) => (truckId ? withSession(state, truckId, () => ({ simulation: { ...IDLE_CONTROL } })) : state)

// ---------- Collection runs ----------
// A run is one trip of one truck along its route (Start Route -> End Route).
// It stores every pickup point's result, so history comes from real records.

// The run screens should show: the truck's open run, else its latest run today.
export function currentRun(state, truckId) {
  return currentRunOf(state, truckIdFor(state, truckId), todayISO())
}

function createRun(state, { by = 'admin', driverId, truckId } = {}) {
  const date = todayISO()
  const truck = truckById(state, truckId)
  const route = routeOfTruck(state, truckId)
  const id = nextId(`RUN-${date}`, state.runs.filter((r) => r.date === date))
  const driver = state.drivers.find((d) => d.id === (driverId ?? truck?.driverId))
  return {
    id,
    date,
    status: 'in-progress', // 'in-progress' | 'completed' | 'ended-early'
    // Not a regular collection day (Mon/Wed/Fri): an office-recorded special run.
    special: !isPickupDate(date, state.scheduleExceptions),
    startedAt: now(),
    endedAt: null,
    startedBy: by,
    truckId: truck?.id ?? null,
    driverId: driver?.id ?? null,
    driverName: driver?.name ?? 'No driver assigned',
    routeId: route?.id ?? null,
    routeName: route?.name ?? '',
    // Snapshot of the pickup points, so later route edits do not change history.
    stops: (route?.stops ?? []).filter(isCollectionStop).map((s) => ({ id: s.id, name: s.name, purok: s.purok, households: s.households })),
    results: {},
  }
}

function closeRun(run) {
  const done = run.stops.every((s) => run.results[s.id])
  return { ...run, endedAt: now(), status: done ? 'completed' : 'ended-early' }
}

function updateRun(state, runId, fn) {
  return { ...state, runs: state.runs.map((r) => (r.id === runId ? fn(r) : r)) }
}

// Records a stop on the truck's current run; starts a run (by admin) if there is none.
function recordStop(state, { truckId: truckIdIn, stopId, status, note = '', by = 'admin', byName = '', bags = null }) {
  const truckId = truckIdIn ?? truckOfStop(state, stopId)?.id ?? focusTruckId(state)
  let next = state
  let run = currentRun(next, truckId)
  // Already recorded as collected: a second tap must not create a new record.
  if (status === 'collected' && run?.results[stopId]?.status === 'collected') return state
  if (!run) {
    run = createRun(next, { by, truckId })
    next = withSession({ ...next, runs: [run, ...next.runs] }, truckId, () => ({ activeRunId: run.id }))
  }
  // simAt: this truck's demo clock when this was recorded, so the truck leaves
  // this stop at the same moment in every tab (null if the truck is not running).
  const sim = simulationOf(next, truckId)
  const simAt = sim && sim.status !== 'idle' && sim.startedAt ? simElapsed(sim, Date.now()) : null
  const result = { status, note, at: now(), by, byName, bags, simAt }
  const routeStops = routeOfTruck(next, truckId)?.stops ?? []
  return updateRun(next, run.id, (r) => ({
    ...r,
    // A stop added to the route after the run started is added to the run too.
    stops: r.stops.some((s) => s.id === stopId)
      ? r.stops
      : [...r.stops, ...routeStops.filter((s) => s.id === stopId).map((s) => ({ id: s.id, name: s.name, purok: s.purok, households: s.households }))],
    results: { ...r.results, [stopId]: result },
  }))
}

// Adds a resident report and alerts the office. Returns the new state and report.
function addReport(state, p) {
  const year = todayISO().slice(0, 4) // Manila year
  const { history: firstEntry = 'Report submitted by resident', ...fields } = p
  const report = {
    ...fields,
    id: p.id ?? nextId(`REP-${year}`, state.reports, 3),
    status: 'submitted',
    submittedAt: now(),
    adminResponse: null,
    history: [{ at: now(), text: firstEntry }],
  }
  return {
    report,
    state: {
      ...state,
      reports: [report, ...state.reports],
      notifications: addNotification(state, {
        audience: 'admin',
        priority: p.category === 'missed' || p.category === 'no-truck' ? 'high' : 'medium',
        title: `New resident report ${report.id}`,
        body: `${p.categoryLabel} at ${p.location}.`,
        link: { label: `Open report ${report.id}`, to: `/admin/resident-reports?id=${report.id}` },
      }),
    },
  }
}

// Every stop id on every route (stop ids are unique across routes).
const allStops = (state) => routesOf(state).flatMap((r) => r.stops)

// Changes a route's stops; that route's truck goes back to the depot.
function editStops(state, routeId, fn) {
  const route = routeById(state, routeId)
  if (!route) return state
  const stops = fn(route.stops)
  if (stops === route.stops) return state
  return resetSim(updateRoute(state, routeId, (r) => ({ ...r, stops })), truckOfRoute(state, routeId)?.id)
}

/**
 * Applies an action. Returns the same object when nothing changed (the server
 * relies on this to skip saving), otherwise new data with the single-truck
 * fields for older screens filled in again (src/store/fleet.js).
 */
export function dataReducer(state, action) {
  const next = reduce(state, action)
  return next === state ? state : withLegacy(next)
}

function reduce(state, action) {
  const p = action.payload
  switch (action.type) {
    // ---------- Trucks ----------
    case 'truck/update': {
      const { id, ...patch } = p
      return updateTruck(state, truckIdFor(state, id), (t) => ({ ...t, ...patch }))
    }

    // The driver on duty. A driver drives one truck at a time.
    case 'truck/assignDriver': {
      const id = truckIdFor(state, p.truckId)
      return {
        ...state,
        trucks: trucksOf(state).map((t) => (t.id === id ? { ...t, driverId: p.driverId } : p.driverId && t.driverId === p.driverId ? { ...t, driverId: null } : t)),
      }
    }

    case 'truck/logMaintenance': {
      const record = { date: p.date, type: p.type, odometerKm: p.odometerKm, notes: p.notes }
      return updateTruck(state, truckIdFor(state, p.truckId), (t) => ({
        ...t,
        odometerKm: Math.max(t.odometerKm ?? 0, p.odometerKm),
        status: p.newStatus,
        maintenance: [record, ...(t.maintenance ?? [])],
        nextServiceDate: p.nextServiceDate || t.nextServiceDate,
      }))
    }

    // A new truck has no route and no driver until the admin assigns them.
    case 'truck/add': {
      const added = {
        id: p.id,
        plateNumber: p.plateNumber,
        type: p.type,
        model: p.model ?? '',
        capacityTons: p.capacityTons,
        fuel: p.fuel,
        odometerKm: p.odometerKm ?? 0,
        driverId: null,
        routeId: null,
        status: p.status,
        maintenance: [],
        nextServiceDate: p.nextServiceDate || null,
      }
      return { ...state, trucks: [...trucksOf(state), added] }
    }

    case 'truck/delete': {
      const { [p.id]: _gone, ...sessions } = state.sessions ?? {}
      return { ...state, trucks: trucksOf(state).filter((t) => t.id !== p.id), sessions }
    }

    // Gives a truck a route (or none). Its demo GPS starts again at the depot.
    // A truck without a route cannot be Delayed or on Standby.
    case 'truck/assignRoute': {
      const next = updateTruck(state, p.id, (t) => ({
        ...t,
        routeId: p.routeId ?? null,
        status: p.routeId || RESERVE_STATUSES.includes(t.status) ? t.status : 'active',
      }))
      return resetSim(next, p.id)
    }

    // Older Truck Management screen ("Make Service Truck"): the truck takes
    // over the first route, with its driver on duty and shift roster; the
    // previous truck keeps its records but no route or driver.
    case 'truck/setService': {
      const from = truckById(state, primaryTruckId(state))
      const to = truckById(state, p.id)
      if (!from || !to || from.id === to.id) return state
      const moveTo = (person) => (person.truckId === from.id ? { ...person, truckId: to.id } : person)
      const trucks = trucksOf(state).map((t) => {
        if (t.id === to.id) return { ...t, routeId: from.routeId, driverId: from.driverId ?? null }
        if (t.id === from.id) return { ...t, routeId: null, driverId: null, status: RESERVE_STATUSES.includes(t.status) ? t.status : 'active' }
        return t
      })
      // The new route truck is listed first, so older screens show it.
      const ordered = [trucks.find((t) => t.id === to.id), ...trucks.filter((t) => t.id !== to.id)]
      const next = { ...state, trucks: ordered, drivers: state.drivers.map(moveTo), crew: (state.crew ?? []).map(moveTo) }
      return resetSim(resetSim(next, from.id), to.id)
    }

    // ---------- Drivers ----------
    case 'driver/add': {
      const driver = { ...p, id: nextId('DRV', state.drivers), initials: initials(p.name) }
      return { ...state, drivers: [...state.drivers, driver] }
    }

    case 'driver/update': {
      const drivers = state.drivers.map((d) => (d.id === p.id ? { ...d, ...p.patch, ...(p.patch.name ? { initials: initials(p.patch.name) } : {}) } : d))
      const updated = drivers.find((d) => d.id === p.id)
      // The driver on duty must hold a slot on that truck (active, on a shift).
      const holds = (t) => updated && updated.active !== false && updated.truckId === t.id && updated.shift
      return { ...state, drivers, trucks: trucksOf(state).map((t) => (t.driverId === p.id && !holds(t) ? { ...t, driverId: null } : t)) }
    }

    case 'driver/delete':
      return {
        ...state,
        drivers: state.drivers.filter((d) => d.id !== p.id),
        // A deleted driver can no longer drive a truck.
        trucks: trucksOf(state).map((t) => (t.driverId === p.id ? { ...t, driverId: null } : t)),
      }

    // ---------- Routes ----------
    case 'route/add': {
      const stops = allStops(state)
      const start = nextId('STP', stops)
      const end = nextId('STP', [...stops, { id: start }])
      const route = {
        id: p.id ?? nextId('RT', routesOf(state)),
        name: p.name,
        shortName: p.shortName ?? '',
        startTime: p.startTime ?? '',
        coordinatesVerified: false,
        stops: [
          { id: start, name: 'Truck Depot (Start)', purok: 'Depot', coords: p.depot, households: 0 },
          { id: end, name: 'Truck Depot (End)', purok: 'Depot', coords: p.depot, households: 0 },
        ],
      }
      return { ...state, routes: [...routesOf(state), route] }
    }

    case 'route/delete':
      return { ...state, routes: routesOf(state).filter((r) => r.id !== p.id) }

    case 'route/update': {
      const { routeId, ...patch } = p
      return updateRoute(state, routeId ?? defaultRouteId(state), (r) => ({ ...r, ...patch }))
    }

    case 'route/updateStop':
      return updateRoute(state, routeOfStop(state, p.id)?.id, (r) => ({ ...r, stops: r.stops.map((s) => (s.id === p.id ? { ...s, ...p.patch } : s)) }))

    case 'route/addStop': {
      const routeId = routeOfStop(state, p.afterId)?.id ?? p.routeId ?? defaultRouteId(state)
      const stop = { id: nextId('STP', allStops(state)), name: p.name, purok: p.purok, households: p.households, coords: p.coords }
      return editStops(state, routeId, (stops) => {
        // Insert after the chosen stop; never after the end depot.
        const after = stops.findIndex((s) => s.id === p.afterId)
        const at = after === -1 || after >= stops.length - 1 ? stops.length - 1 : after + 1
        return [...stops.slice(0, at), stop, ...stops.slice(at)]
      })
    }

    case 'route/removeStop':
      return editStops(state, routeOfStop(state, p.id)?.id, (stops) => {
        const stop = stops.find((s) => s.id === p.id)
        // Depots stay, and the route keeps at least one pickup point.
        if (!stop || !isCollectionStop(stop) || stops.filter(isCollectionStop).length <= 1) return stops
        return stops.filter((s) => s.id !== p.id)
      })

    case 'route/moveStop':
      return editStops(state, routeOfStop(state, p.id)?.id, (stops) => {
        const i = stops.findIndex((s) => s.id === p.id)
        const j = i + p.dir
        // Pickup points move only between the start depot (0) and end depot (last).
        if (i < 1 || i > stops.length - 2 || j < 1 || j > stops.length - 2) return stops
        const moved = [...stops]
        ;[moved[i], moved[j]] = [moved[j], moved[i]]
        return moved
      })

    case 'schedule/update':
      return {
        ...state,
        weeklySchedule: state.weeklySchedule.map((d) => (d.day === p.day ? { ...d, ...p.patch } : d)),
      }

    // ---------- Collection runs (per truck) ----------
    case 'run/start': {
      const truckId = truckIdFor(state, p.truckId)
      const open = state.runs.find((r) => r.id === activeRunIdOf(state, truckId))
      if (open && open.date === todayISO()) return state // already running today
      let next = state
      if (open) next = updateRun(next, open.id, closeRun) // left open on an earlier day
      const run = createRun(next, { ...p, truckId })
      return withSession({ ...next, runs: [run, ...next.runs] }, truckId, () => ({ activeRunId: run.id }))
    }

    case 'run/end': {
      const truckId = truckIdFor(state, p?.truckId)
      const runId = activeRunIdOf(state, truckId)
      if (!runId) return state
      return withSession(updateRun(state, runId, closeRun), truckId, () => ({ activeRunId: null }))
    }

    case 'collection/mark':
      return recordStop(state, p)

    case 'collection/clear': {
      const run = currentRun(state, p.truckId ?? truckOfStop(state, p.stopId)?.id)
      if (!run?.results[p.stopId]) return state
      return updateRun(state, run.id, (r) => {
        const results = { ...r.results }
        delete results[p.stopId]
        return { ...r, results }
      })
    }

    case 'collection/clearAll': {
      const run = currentRun(state, p?.truckId)
      if (!run) return state
      return updateRun(state, run.id, (r) => ({ ...r, results: {} }))
    }

    // ---------- Demo truck (simulated GPS) controls, per truck ----------
    case 'sim/start': {
      const truckId = truckIdFor(state, p?.truckId)
      const status = simulationOf(state, truckId).status
      // force: restart even if the truck already reached the end of the route.
      if (!p?.force && (status === 'running' || status === 'paused')) return state
      return withSession(state, truckId, () => ({ simulation: { ...IDLE_CONTROL, status: 'running', startedAt: now() } }))
    }

    case 'sim/pause': {
      const truckId = truckIdFor(state, p?.truckId)
      const sim = simulationOf(state, truckId)
      if (sim.status !== 'running') return state
      return withSession(state, truckId, () => ({ simulation: { ...sim, status: 'paused', pausedAt: now() } }))
    }

    case 'sim/resume': {
      const truckId = truckIdFor(state, p?.truckId)
      const sim = simulationOf(state, truckId)
      if (sim.status !== 'paused') return state
      const pausedFor = Date.now() - Date.parse(sim.pausedAt)
      return withSession(state, truckId, () => ({ simulation: { ...sim, status: 'running', pausedAt: null, pausedMs: (sim.pausedMs || 0) + pausedFor } }))
    }

    // Back to the depot, not started.
    case 'sim/reset':
      return resetSim(state, truckIdFor(state, p?.truckId))

    case 'sim/stop': {
      const truckId = truckIdFor(state, p?.truckId)
      const sim = simulationOf(state, truckId)
      if (sim.status !== 'running' && sim.status !== 'paused') return state
      // Freeze the clock where the truck is now.
      const frozenAt = sim.status === 'paused' ? sim.pausedAt : now()
      return withSession(state, truckId, () => ({ simulation: { ...sim, status: 'stopped', stoppedAt: frozenAt, pausedAt: null } }))
    }

    case 'notification/add':
      // `key` makes automatic messages appear only once (e.g. per day, per purok).
      if (p.key && state.notifications.some((n) => n.key === p.key)) return state
      return { ...state, notifications: addNotification(state, p) }

    case 'report/update': {
      const report = state.reports.find((r) => r.id === p.id)
      if (!report) return state
      const entries = []
      if (p.status && p.status !== report.status) {
        entries.push({ at: now(), text: `Status changed to ${p.statusLabel ?? p.status}` })
      }
      if (p.adminResponse !== undefined && p.adminResponse !== report.adminResponse) {
        entries.push({ at: now(), text: 'Barangay response updated' })
      }
      if (entries.length === 0) return state
      const updated = {
        ...report,
        ...(p.status ? { status: p.status } : {}),
        ...(p.adminResponse !== undefined ? { adminResponse: p.adminResponse } : {}),
        history: [...report.history, ...entries],
      }
      return {
        ...state,
        reports: state.reports.map((r) => (r.id === p.id ? updated : r)),
        // Let the resident know in their app.
        notifications: addNotification(state, {
          audience: 'resident',
          residentId: report.residentId,
          priority: 'medium',
          title: `Update on report ${report.id}`,
          body: updated.adminResponse || `Your report is now ${p.statusLabel ?? updated.status}.`,
          link: { label: 'View Report', to: `/resident/reports/${report.id}` },
        }),
      }
    }

    // userKey: who read it ('ADMIN', a driver id or a resident id).
    case 'notification/markRead':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === p.id ? markReadBy(n, p.userKey) : n)),
      }

    case 'notification/markAllRead':
      // Either every notification for an audience, or a given list of ids.
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          (p.ids ? p.ids.includes(n.id) : n.audience === p.audience) ? markReadBy(n, p.userKey) : n,
        ),
      }

    case 'resident/add': {
      const num = p.id.split('-').pop()
      const resident = {
        ...p,
        initials: initials(p.name),
        householdId: `HH-RIZAL-${num}`,
        prefs: { email: true, push: true, scheduleReminders: true, truckNearby: true },
        createdAt: now(),
      }
      return { ...state, residents: [...state.residents, resident] }
    }

    case 'resident/update':
      return {
        ...state,
        residents: state.residents.map((r) =>
          r.id === p.id ? { ...r, ...p.patch, ...(p.patch.name ? { initials: initials(p.patch.name) } : {}) } : r,
        ),
      }

    case 'report/add':
      return addReport(state, p).state

    // Resident pickup feedback. One record per resident per date: answering
    // again replaces the earlier answer (latest answer kept).
    case 'feedback/submit': {
      const list = state.collectionFeedback ?? []
      const id = feedbackId(p.residentId, p.date)
      const existing = list.find((f) => f.id === id)
      let next = state
      let reportId = existing?.reportId ?? null
      // A reason that needs follow-up becomes a resident report (once).
      if (p.report && !reportId) {
        const added = addReport(next, { ...p.report, history: 'Sent from pickup feedback' })
        next = added.state
        reportId = added.report.id
      }
      const record = {
        id,
        residentId: p.residentId,
        residentName: p.residentName ?? '',
        purok: p.purok ?? '',
        date: p.date,
        runId: p.runId ?? null,
        willDispose: Boolean(p.willDispose),
        truckPassed: p.truckPassed ?? null,
        disposed: p.disposed ?? null,
        reason: p.reason ?? null,
        reasonText: p.reasonText ?? '',
        reportId,
        submittedAt: existing?.submittedAt ?? now(),
        updatedAt: now(),
      }
      return {
        ...next,
        collectionFeedback: [record, ...list.filter((f) => f.id !== id)],
        // Answered: the day's "Pick Up Check" message no longer shows as new.
        notifications: next.notifications.map((n) => (n.key === `pickup-check-${p.date}` ? markReadBy(n, p.residentId) : n)),
      }
    }

    case 'driver/reportIssue': {
      // Every problem is saved, so the office can see it in Collection Monitoring.
      const issues = state.driverIssues ?? []
      const issue = {
        id: nextId('ISS', issues, 3),
        reportedAt: now(),
        driverId: p.driverId ?? null,
        driverName: p.driverName ?? 'Driver',
        truckId: truckIdFor(state, p.truckId),
        runId: currentRun(state, truckIdFor(state, p.truckId))?.id ?? null,
        stopId: p.stopId ?? null,
        stopName: p.stopName ?? null,
        issueType: p.issueType ?? 'other',
        issueLabel: p.issueLabel,
        description: p.description,
        photo: p.photo ?? null,
        notifiedOffice: Boolean(p.notifyDispatch),
        markedMissed: Boolean(p.markMissed && p.stopId),
      }
      let next = { ...state, driverIssues: [issue, ...issues] }
      const where = p.stopName ? ` at ${p.stopName}` : ''
      if (p.notifyDispatch) {
        next = {
          ...next,
          notifications: addNotification(next, {
            audience: 'admin',
            priority: 'high',
            title: `Driver issue${where}: ${p.issueLabel}`,
            body: `${p.driverName}: ${p.description}`,
            photo: p.photo ?? null,
            link: { label: 'Open Collection Monitoring', to: '/admin/collection' },
          }),
        }
      }
      if (p.markMissed && p.stopId) {
        next = recordStop(next, {
          truckId: truckIdFor(state, p.truckId),
          stopId: p.stopId,
          status: 'missed',
          note: `${p.issueLabel} — ${p.description}`,
          by: 'driver',
          byName: p.driverName,
        })
      }
      return next
    }

    // Another browser tab saved newer data. Keep unchanged parts as the same
    // objects so, e.g., a running simulation is not restarted needlessly.
    case 'sync': {
      const merged = { ...p }
      for (const key of Object.keys(p)) {
        if (JSON.stringify(state[key]) === JSON.stringify(p[key])) merged[key] = state[key]
      }
      return merged
    }

    case 'broadcast/add': {
      const broadcast = { id: nextId('B', state.broadcasts), sentAt: now(), ...p }
      return {
        ...state,
        broadcasts: [broadcast, ...state.broadcasts],
        notifications: addNotification(state, {
          audience: 'resident',
          priority: 'medium',
          title: p.subject,
          body: p.message,
          zone: p.zone,
          kind: 'advisory',
        }),
      }
    }

    // ---------- Truck crew ----------
    case 'crew/add': {
      const crew = state.crew ?? []
      return { ...state, crew: [...crew, { ...p, id: nextId('CRW', crew), createdAt: now() }] }
    }

    case 'crew/update':
      return { ...state, crew: (state.crew ?? []).map((c) => (c.id === p.id ? { ...c, ...p.patch } : c)) }

    case 'crew/delete':
      return { ...state, crew: (state.crew ?? []).filter((c) => c.id !== p.id) }

    // Suspension: that date has no regular pickup. Residents are told.
    case 'schedule/addException': {
      const list = (state.scheduleExceptions ?? []).filter((x) => x.date !== p.date)
      const item = { date: p.date, kind: p.kind, reason: p.reason, createdAt: now() }
      return {
        ...state,
        scheduleExceptions: [...list, item].sort((a, b) => a.date.localeCompare(b.date)),
        notifications: addNotification(state, {
          audience: 'resident',
          zone: 'All Puroks',
          kind: 'advisory',
          priority: 'high',
          key: `exception-${p.date}`,
          title: `No garbage pickup on ${formatDate(p.date)}`,
          body: `${exceptionLabel(p.kind)}: ${p.reason}`,
          link: { label: 'See pickup days', to: '/resident/schedule' },
        }).filter((n, i, all) => !n.key || all.findIndex((m) => m.key === n.key) === i),
      }
    }

    case 'schedule/removeException':
      return { ...state, scheduleExceptions: (state.scheduleExceptions ?? []).filter((x) => x.date !== p.date) }

    case 'admin/setPhoto':
      return { ...state, adminPhoto: p.photo ?? null }

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...p }, savedAt: now() }

    case 'reset':
      return p

    default:
      throw new Error(`Unknown data action: ${action.type}`)
  }
}
