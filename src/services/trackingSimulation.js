// SIMULATED TRACKING ENGINE
// This prototype has no GPS hardware. This module "drives" one truck along the
// route's stops on a timer so the maps have something to show. It knows nothing
// about React or Leaflet; screens read its state and draw it.
//
// Status flow:
//   idle --start--> running --pause--> paused --resume--> running
//   running/paused --stop--> stopped --start--> running (from the beginning)
//   running --(reaches last stop)--> completed --start--> running

export const SIMULATION_LABEL = 'Simulated GPS · demo data, not a real truck location'

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

// Depots have no bins; every other stop is a collection stop.
export const isCollectionStop = (stop) => stop.bins > 0

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
    collectedStopIds: [],
    updatedAt: null,
  }
}

/**
 * Creates one simulation. Only one movement timer can exist per simulation:
 * every action clears the old timer before starting a new one.
 *
 * @param {object}   opts
 * @param {object}   opts.route        route with ordered `stops` ({ id, coords, bins })
 * @param {number}   opts.tickMs       how often the truck moves (ms)
 * @param {number}   opts.stepsPerLeg  how many ticks it takes to drive between two stops
 * @param {Function} opts.onChange     called with the new state after every change
 */
export function createTrackingSimulation({ route, tickMs = 1000, stepsPerLeg = 6, onChange = () => {} }) {
  const error = validateRoute(route)
  if (error) throw new Error(error)

  const stops = route.stops
  let state = getInitialState(route)
  let timer = null
  let disposed = false

  function emit(patch) {
    state = { ...state, ...patch, updatedAt: new Date().toISOString() }
    if (!disposed) onChange(state)
  }

  function clearTimer() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  function startTimer() {
    clearTimer()
    timer = setInterval(tick, tickMs)
  }

  function tick() {
    let { legIndex, step, collectedStopIds } = state
    step += 1

    // Arrived at the next stop.
    if (step >= stepsPerLeg) {
      legIndex += 1
      step = 0
      const arrived = stops[legIndex]
      if (isCollectionStop(arrived) && !collectedStopIds.includes(arrived.id)) {
        collectedStopIds = [...collectedStopIds, arrived.id]
      }
    }

    const finished = legIndex >= stops.length - 1
    const from = stops[legIndex]
    const to = stops[Math.min(legIndex + 1, stops.length - 1)]
    const t = finished ? 0 : step / stepsPerLeg

    if (finished) clearTimer()

    emit({
      status: finished ? 'completed' : 'running',
      legIndex,
      step,
      position: { lat: lerp(from.coords[0], to.coords[0], t), lng: lerp(from.coords[1], to.coords[1], t) },
      // Made-up but plausible barangay speed; 0 while stopped at a stop.
      speedKmh: finished || step === 0 ? 0 : 14 + ((legIndex * 3 + step * 5) % 9),
      collectedStopIds,
    })
  }

  return {
    getState: () => state,

    // Starts from the first stop. Ignored while already running or paused.
    start() {
      if (disposed || state.status === 'running' || state.status === 'paused') return
      state = getInitialState(route)
      emit({ status: 'running' })
      startTimer()
    },

    pause() {
      if (disposed || state.status !== 'running') return
      clearTimer()
      emit({ status: 'paused', speedKmh: 0 })
    },

    // Continues from exactly where it was paused.
    resume() {
      if (disposed || state.status !== 'paused') return
      emit({ status: 'running' })
      startTimer()
    },

    // Ends the run. The truck stays where it stopped until Start is pressed again.
    stop() {
      if (disposed || (state.status !== 'running' && state.status !== 'paused')) return
      clearTimer()
      emit({ status: 'stopped', speedKmh: 0 })
    },

    // Call when the simulation is no longer needed (e.g. component unmounts).
    dispose() {
      clearTimer()
      disposed = true
    },

    // For tests: true while a movement timer exists.
    hasActiveTimer: () => timer !== null,
  }
}

/**
 * Collection progress derived from the simulation state, for cards and lists.
 */
export function getRouteProgress(route, state) {
  const collectionStops = route.stops.filter(isCollectionStop)
  const collected = state.collectedStopIds.length
  const total = collectionStops.length
  const active = state.status === 'running' || state.status === 'paused'
  const nextStop = active ? route.stops[state.legIndex + 1] ?? null : null

  // 'collected' | 'next' | 'pending' | 'depot'
  function statusOf(stop) {
    if (state.collectedStopIds.includes(stop.id)) return 'collected'
    if (nextStop && stop.id === nextStop.id) return 'next'
    if (!isCollectionStop(stop)) return 'depot'
    return 'pending'
  }

  return {
    total,
    collected,
    remaining: total - collected,
    percent: total ? Math.round((collected / total) * 100) : 0,
    totalBins: collectionStops.reduce((sum, s) => sum + s.bins, 0),
    collectedBins: collectionStops
      .filter((s) => state.collectedStopIds.includes(s.id))
      .reduce((sum, s) => sum + s.bins, 0),
    nextStop,
    statusOf,
  }
}
