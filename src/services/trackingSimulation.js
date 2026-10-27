// SIMULATED TRACKING ENGINE (demo mode)
// CleanTrack has no GPS device connected. This module works out where the demo
// truck is on the route. Every position is tagged source: 'SIMULATED' so it can
// never be mixed up with real GPS data (see services/locationSource.js). It
// knows nothing about React or Leaflet; screens read its result and draw it.
//
// How it works: the position is a PURE FUNCTION of the simulation controls
// (when it started, pauses), the saved stop records, and the clock. So every
// browser tab (Admin, Driver, Resident) shows the same truck, a page reload
// keeps the truck where it was, and every demo behaves the same way.
//
// The simulation only MOVES the truck. It never decides that garbage was
// collected: at each pickup point the truck waits until the driver or office
// records the stop (collected or missed), then drives on.
//
// Control status flow (saved in the data store as `simulation`):
//   idle --start--> running --pause--> paused --resume--> running
//   running/paused --stop--> stopped --start--> running (from the beginning)
//   running --(reaches last stop)--> shown as 'completed'

export const SIMULATION_LABEL = 'SIMULATED GPS — DEMO MODE · not a real truck location'
export const LOCATION_SOURCE = 'SIMULATED'

export const STATUS_LABELS = {
  idle: 'Not started',
  running: 'Moving',
  paused: 'Paused',
  stopped: 'Stopped',
  completed: 'Route completed',
}

export const STATUS_TONES = {
  idle: 'gray',
  running: 'green',
  paused: 'amber',
  stopped: 'red',
  completed: 'blue',
}

// Depots serve no households; every other stop is a pickup point.
export const isCollectionStop = (stop) => stop.households > 0

function lerp(a, b, t) {
  return a + (b - a) * t
}

export function validateRoute(route) {
  if (!route || !Array.isArray(route.stops) || route.stops.length < 2) {
    return 'This route needs at least two stops before it can be simulated.'
  }
  const bad = route.stops.find(
    (s) => !Array.isArray(s.coords) || s.coords.length !== 2 || s.coords.some((n) => !Number.isFinite(n)),
  )
  if (bad) return `Stop "${bad.name}" has missing or invalid coordinates.`
  return null
}

export function getInitialState(route) {
  const first = route?.stops?.[0]
  return {
    status: 'idle',
    legIndex: 0, // truck is between stops[legIndex] and stops[legIndex + 1]
    step: 0, // progress along the current leg, 0..stepsPerLeg
    position: first ? { lat: first.coords[0], lng: first.coords[1] } : null,
    speedKmh: 0,
    waitingAt: null, // id of the pickup point the truck is waiting at
    startedAt: null,
    source: LOCATION_SOURCE,
    updatedAt: null,
  }
}

export const IDLE_CONTROL = { status: 'idle', startedAt: null, pausedAt: null, stoppedAt: null, pausedMs: 0 }

// Simulation time (ms of driving time) at wall-clock time `nowMs`. Paused time
// does not count; after Stop the clock is frozen at the moment it stopped.
export function simElapsed(control, nowMs) {
  if (!control?.startedAt) return 0
  const start = Date.parse(control.startedAt)
  const end =
    control.status === 'paused' ? Date.parse(control.pausedAt) : control.status === 'stopped' ? Date.parse(control.stoppedAt) : nowMs
  return Math.max(0, end - start - (control.pausedMs || 0))
}

/**
 * Where the truck is.
 *
 * @param {object} opts.route        route with ordered `stops` ({ id, coords, households })
 * @param {object} opts.control      { status, startedAt, pausedAt, stoppedAt, pausedMs }
 * @param {object} opts.results      saved records { [stopId]: { status, simAt } }; simAt is
 *                                   the simulation time when the stop was recorded
 * @param {number} opts.nowMs        current time (Date.now())
 * @param {number} opts.tickMs       one movement step (Settings → update interval)
 * @param {number} opts.stepsPerLeg  steps to drive from one stop to the next
 */
export function computeSimulation({ route, control = IDLE_CONTROL, results = {}, nowMs = Date.now(), tickMs = 1000, stepsPerLeg = 6 }) {
  const base = getInitialState(route)
  if (!control || control.status === 'idle' || !control.startedAt) return base

  const stops = route.stops
  const legMs = tickMs * stepsPerLeg
  const elapsed = simElapsed(control, nowMs)
  let t = 0 // simulation time when the truck leaves stops[i]
  for (let i = 0; i < stops.length - 1; i++) {
    const arrive = t + legMs
    const next = stops[i + 1]
    if (elapsed < arrive) {
      // Driving between stops[i] and stops[i + 1].
      const f = (elapsed - t) / legMs
      const step = Math.min(stepsPerLeg - 1, Math.floor(f * stepsPerLeg))
      return {
        ...base,
        status: control.status,
        legIndex: i,
        step,
        position: { lat: lerp(stops[i].coords[0], next.coords[0], f), lng: lerp(stops[i].coords[1], next.coords[1], f) },
        speedKmh: control.status === 'running' ? 14 + ((i * 3 + step * 5) % 9) : 0,
        startedAt: control.startedAt,
        updatedAt: new Date(nowMs).toISOString(),
      }
    }
    // Arrived at stops[i + 1]. A pickup point holds the truck until recorded.
    let leave = arrive
    if (isCollectionStop(next)) {
      const rec = results[next.id]
      if (!rec) {
        return {
          ...base,
          status: control.status,
          legIndex: i + 1,
          step: 0,
          position: { lat: next.coords[0], lng: next.coords[1] },
          waitingAt: next.id,
          startedAt: control.startedAt,
          updatedAt: new Date(nowMs).toISOString(),
        }
      }
      // Recorded before the truck got there (or with no time): no wait.
      leave = Math.max(arrive, Number.isFinite(rec.simAt) ? rec.simAt : 0)
      if (elapsed < leave) {
        return {
          ...base,
          status: control.status,
          legIndex: i + 1,
          step: 0,
          position: { lat: next.coords[0], lng: next.coords[1] },
          startedAt: control.startedAt,
          updatedAt: new Date(nowMs).toISOString(),
        }
      }
    }
    t = leave
  }
  // Reached the end depot.
  const last = stops[stops.length - 1]
  return {
    ...base,
    status: control.status === 'stopped' ? 'stopped' : 'completed',
    legIndex: stops.length - 1,
    step: 0,
    position: { lat: last.coords[0], lng: last.coords[1] },
    startedAt: control.startedAt,
    updatedAt: new Date(nowMs).toISOString(),
  }
}

/**
 * Collection progress for cards, lists and map colours.
 * Collected/missed come ONLY from the saved records (`results`, written when the
 * driver or admin records a stop). The simulation only says where the truck is
 * heading ("next").
 *
 * @param {object} results  { [stopId]: { status: 'collected' | 'missed', ... } }
 */
export function getRouteProgress(route, state, results = {}) {
  const pickupStops = route.stops.filter(isCollectionStop)
  const recorded = (stop) => results[stop.id]?.status
  const active = state.status === 'running' || state.status === 'paused'
  const nextStop = state.waitingAt
    ? route.stops.find((s) => s.id === state.waitingAt) ?? null
    : active
      ? route.stops[state.legIndex + 1] ?? null
      : null

  // 'collected' | 'missed' | 'next' | 'pending' | 'depot'
  function statusOf(stop) {
    const r = recorded(stop)
    if (r === 'collected' || r === 'missed') return r
    if (!isCollectionStop(stop)) return 'depot'
    if (nextStop && stop.id === nextStop.id) return 'next'
    return 'pending'
  }

  const collected = pickupStops.filter((s) => recorded(s) === 'collected').length
  const missed = pickupStops.filter((s) => recorded(s) === 'missed').length
  const total = pickupStops.length
  return {
    total,
    collected,
    missed,
    remaining: total - collected - missed,
    percent: total ? Math.round((collected / total) * 100) : 0,
    totalHouseholds: pickupStops.reduce((sum, s) => sum + s.households, 0),
    collectedHouseholds: pickupStops.filter((s) => recorded(s) === 'collected').reduce((sum, s) => sum + s.households, 0),
    nextStop,
    waitingAt: state.waitingAt,
    statusOf,
  }
}
