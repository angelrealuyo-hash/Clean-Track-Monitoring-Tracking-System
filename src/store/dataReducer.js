// Every change to the demo data goes through here.
import { todayISO } from '../utils/format.js'
import { IDLE_CONTROL, isCollectionStop, simElapsed } from '../services/trackingSimulation.js'

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

// ---------- Collection runs ----------
// A run is one trip of the truck along the route (Start Route -> End Route).
// It stores every pickup point's result, so history comes from real records.

// The run screens should show: the open run, else today's latest run.
export function currentRun(state) {
  const active = state.runs.find((r) => r.id === state.activeRunId)
  if (active) return active
  const today = todayISO()
  return state.runs.find((r) => r.date === today) ?? null
}

function createRun(state, { by = 'admin', driverId } = {}) {
  const date = todayISO()
  const id = nextId(`RUN-${date}`, state.runs.filter((r) => r.date === date))
  const driver = state.drivers.find((d) => d.id === (driverId ?? state.truck.driverId))
  return {
    id,
    date,
    status: 'in-progress', // 'in-progress' | 'completed' | 'ended-early'
    startedAt: now(),
    endedAt: null,
    startedBy: by,
    truckId: state.truck.id,
    driverId: driver?.id ?? null,
    driverName: driver?.name ?? 'No driver assigned',
    routeId: state.route.id,
    routeName: state.route.name,
    // Snapshot of the pickup points, so later route edits do not change history.
    stops: state.route.stops.filter(isCollectionStop).map((s) => ({ id: s.id, name: s.name, purok: s.purok, households: s.households })),
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

// Records a stop on the current run; starts a run (by admin) if there is none.
function recordStop(state, { stopId, status, note = '', by = 'admin', byName = '', bags = null }) {
  let next = state
  let run = currentRun(next)
  if (!run) {
    run = createRun(next, { by })
    next = { ...next, runs: [run, ...next.runs], activeRunId: run.id }
  }
  // simAt: the demo truck's clock when this was recorded, so the truck leaves
  // this stop at the same moment in every tab (null if the truck is not running).
  const sim = next.simulation
  const simAt = sim && sim.status !== 'idle' && sim.startedAt ? simElapsed(sim, Date.now()) : null
  const result = { status, note, at: now(), by, byName, bags, simAt }
  return updateRun(next, run.id, (r) => ({
    ...r,
    // A stop added to the route after the run started is added to the run too.
    stops: r.stops.some((s) => s.id === stopId)
      ? r.stops
      : [...r.stops, ...next.route.stops.filter((s) => s.id === stopId).map((s) => ({ id: s.id, name: s.name, purok: s.purok, households: s.households }))],
    results: { ...r.results, [stopId]: result },
  }))
}

export function dataReducer(state, action) {
  const p = action.payload
  switch (action.type) {
    case 'truck/update':
      return { ...state, truck: { ...state.truck, ...p } }

    case 'truck/assignDriver':
      return { ...state, truck: { ...state.truck, driverId: p.driverId } }

    case 'truck/logMaintenance': {
      const record = { date: p.date, type: p.type, odometerKm: p.odometerKm, notes: p.notes }
      return {
        ...state,
        truck: {
          ...state.truck,
          odometerKm: Math.max(state.truck.odometerKm, p.odometerKm),
          status: p.newStatus,
          maintenance: [record, ...state.truck.maintenance],
          nextServiceDate: p.nextServiceDate || state.truck.nextServiceDate,
        },
      }
    }

    case 'driver/add': {
      const driver = { ...p, id: nextId('DRV', state.drivers), initials: initials(p.name) }
      return { ...state, drivers: [...state.drivers, driver] }
    }

    case 'driver/update':
      return {
        ...state,
        drivers: state.drivers.map((d) =>
          d.id === p.id ? { ...d, ...p.patch, ...(p.patch.name ? { initials: initials(p.patch.name) } : {}) } : d,
        ),
      }

    case 'driver/delete':
      return {
        ...state,
        drivers: state.drivers.filter((d) => d.id !== p.id),
        // A deleted driver can no longer drive the truck.
        truck: state.truck.driverId === p.id ? { ...state.truck, driverId: null } : state.truck,
      }

    case 'route/update':
      return { ...state, route: { ...state.route, ...p } }

    case 'route/updateStop':
      return {
        ...state,
        route: {
          ...state.route,
          stops: state.route.stops.map((s) => (s.id === p.id ? { ...s, ...p.patch } : s)),
        },
      }

    case 'schedule/update':
      return {
        ...state,
        weeklySchedule: state.weeklySchedule.map((d) => (d.day === p.day ? { ...d, ...p.patch } : d)),
      }

    case 'run/start': {
      const open = state.runs.find((r) => r.id === state.activeRunId)
      if (open && open.date === todayISO()) return state // already running today
      let next = state
      if (open) next = updateRun(next, open.id, closeRun) // left open on an earlier day
      const run = createRun(next, p)
      return { ...next, runs: [run, ...next.runs], activeRunId: run.id }
    }

    case 'run/end': {
      if (!state.activeRunId) return state
      return { ...updateRun(state, state.activeRunId, closeRun), activeRunId: null }
    }

    case 'collection/mark':
      return recordStop(state, p)

    // ---------- Demo truck (simulated GPS) controls ----------
    case 'sim/start': {
      // force: restart even if the truck already reached the end of the route.
      const status = state.simulation?.status
      if (!p?.force && (status === 'running' || status === 'paused')) return state
      return { ...state, simulation: { ...IDLE_CONTROL, status: 'running', startedAt: now() } }
    }

    case 'sim/pause':
      if (state.simulation?.status !== 'running') return state
      return { ...state, simulation: { ...state.simulation, status: 'paused', pausedAt: now() } }

    case 'sim/resume': {
      const sim = state.simulation
      if (sim?.status !== 'paused') return state
      const pausedFor = Date.now() - Date.parse(sim.pausedAt)
      return { ...state, simulation: { ...sim, status: 'running', pausedAt: null, pausedMs: (sim.pausedMs || 0) + pausedFor } }
    }

    // Back to the depot, not started.
    case 'sim/reset':
      return { ...state, simulation: { ...IDLE_CONTROL } }

    case 'sim/stop': {
      const sim = state.simulation
      if (sim?.status !== 'running' && sim?.status !== 'paused') return state
      // Freeze the clock where the truck is now.
      const frozenAt = sim.status === 'paused' ? sim.pausedAt : now()
      return { ...state, simulation: { ...sim, status: 'stopped', stoppedAt: frozenAt, pausedAt: null } }
    }

    case 'collection/clear': {
      const run = currentRun(state)
      if (!run) return state
      return updateRun(state, run.id, (r) => {
        const results = { ...r.results }
        delete results[p.stopId]
        return { ...r, results }
      })
    }

    case 'collection/clearAll': {
      const run = currentRun(state)
      if (!run) return state
      return updateRun(state, run.id, (r) => ({ ...r, results: {} }))
    }

    case 'route/addStop': {
      const stops = state.route.stops
      const stop = { id: nextId('STP', stops), name: p.name, purok: p.purok, households: p.households, coords: p.coords }
      // Insert after the chosen stop; never after the end depot.
      const after = stops.findIndex((s) => s.id === p.afterId)
      const at = after === -1 || after >= stops.length - 1 ? stops.length - 1 : after + 1
      return { ...state, route: { ...state.route, stops: [...stops.slice(0, at), stop, ...stops.slice(at)] }, simulation: { ...IDLE_CONTROL } }
    }

    case 'route/removeStop': {
      const stops = state.route.stops
      const stop = stops.find((s) => s.id === p.id)
      // Depots stay, and the route keeps at least one pickup point.
      if (!stop || !isCollectionStop(stop) || stops.filter(isCollectionStop).length <= 1) return state
      return { ...state, route: { ...state.route, stops: stops.filter((s) => s.id !== p.id) }, simulation: { ...IDLE_CONTROL } }
    }

    case 'route/moveStop': {
      const stops = [...state.route.stops]
      const i = stops.findIndex((s) => s.id === p.id)
      const j = i + p.dir
      // Pickup points move only between the start depot (0) and end depot (last).
      if (i < 1 || i > stops.length - 2 || j < 1 || j > stops.length - 2) return state
      ;[stops[i], stops[j]] = [stops[j], stops[i]]
      return { ...state, route: { ...state.route, stops }, simulation: { ...IDLE_CONTROL } }
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

    case 'report/add': {
      const year = new Date().getFullYear()
      const report = {
        ...p,
        id: p.id ?? nextId(`REP-${year}`, state.reports, 3),
        status: 'submitted',
        submittedAt: now(),
        adminResponse: null,
        history: [{ at: now(), text: 'Report submitted by resident' }],
      }
      return {
        ...state,
        reports: [report, ...state.reports],
        notifications: addNotification(state, {
          audience: 'admin',
          priority: p.category === 'missed' || p.category === 'no-truck' ? 'high' : 'medium',
          title: `New resident report ${report.id}`,
          body: `${p.categoryLabel} at ${p.location}.`,
          link: { label: `Open report ${report.id}`, to: `/admin/resident-reports?id=${report.id}` },
        }),
      }
    }

    case 'driver/reportIssue': {
      let next = state
      if (p.notifyDispatch) {
        next = {
          ...next,
          notifications: addNotification(next, {
            audience: 'admin',
            priority: 'high',
            title: `Driver issue at ${p.stopName}: ${p.issueLabel}`,
            body: `${p.driverName}: ${p.description}`,
            photo: p.photo ?? null,
            link: { label: 'Open Collection Monitoring', to: '/admin/collection' },
          }),
        }
      }
      if (p.markMissed) {
        next = recordStop(next, {
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

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...p }, savedAt: now() }

    case 'reset':
      return p

    default:
      throw new Error(`Unknown data action: ${action.type}`)
  }
}
