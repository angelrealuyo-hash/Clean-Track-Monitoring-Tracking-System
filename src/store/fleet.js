// Several garbage trucks, each operating independently (shared by the screens
// and the server).
//
// The data keeps:
//   trucks:   every registered truck { id, ..., routeId, driverId, status }
//   routes:   every collection route { id, name, ..., stops }
//   sessions: { [truckId]: { simulation, activeRunId } }   one per truck
//
// One purok, one truck: a purok's pickup points are on one route only, and a
// route belongs to at most one truck, so every purok has at most one truck.
//
// Older screens read ONE truck as `truck`, `route`, `simulation` and
// `activeRunId`. withLegacy() fills those in from the data above for the
// "focus" truck: a driver's own truck, the truck serving a resident's purok,
// or (admin) the first truck that has a route. They are derived, never saved.
import { IDLE_CONTROL, isCollectionStop } from '../services/trackingSimulation.js'

export const IDLE_SESSION = Object.freeze({ simulation: IDLE_CONTROL, activeRunId: null })

export const trucksOf = (state) => state.trucks ?? []
export const routesOf = (state) => state.routes ?? []
export const truckById = (state, id) => trucksOf(state).find((t) => t.id === id) ?? null
export const routeById = (state, id) => (id ? routesOf(state).find((r) => r.id === id) ?? null : null)
export const routeOfTruck = (state, truckId) => routeById(state, truckById(state, truckId)?.routeId)
export const truckOfRoute = (state, routeId) => (routeId ? trucksOf(state).find((t) => t.routeId === routeId) ?? null : null)
export const sessionOf = (state, truckId) => state.sessions?.[truckId] ?? IDLE_SESSION
export const simulationOf = (state, truckId) => sessionOf(state, truckId).simulation ?? IDLE_CONTROL
export const activeRunIdOf = (state, truckId) => sessionOf(state, truckId).activeRunId ?? null
export const isMoving = (control) => control?.status === 'running' || control?.status === 'paused'

/** The route a stop is on (stop ids are unique across routes). */
export const routeOfStop = (state, stopId) => routesOf(state).find((r) => r.stops.some((s) => s.id === stopId)) ?? null
export const truckOfStop = (state, stopId) => truckOfRoute(state, routeOfStop(state, stopId)?.id)

/** First truck that has a route, else the first truck. The default for older callers. */
export function primaryTruckId(state) {
  const trucks = trucksOf(state)
  return (trucks.find((t) => t.routeId && routeById(state, t.routeId)) ?? trucks[0])?.id ?? null
}

/** The truck this driver is driving (driver on duty). */
export const truckOfDriver = (state, driverId) => trucksOf(state).find((t) => t.driverId === driverId) ?? null

/** The truck whose roster this driver is on (may not be on duty). */
export const rosterTruckOfDriver = (state, driverId) => truckById(state, (state.drivers ?? []).find((d) => d.id === driverId)?.truckId)

/** Routes with a pickup point in this purok (depots do not count). */
export const routesForPurok = (state, purok) => routesOf(state).filter((r) => r.stops.some((s) => isCollectionStop(s) && s.purok === purok))

/** The truck serving this purok (one purok, one truck), or null. */
export function truckForPurok(state, purok) {
  for (const r of routesForPurok(state, purok)) {
    const t = truckOfRoute(state, r.id)
    if (t) return t
  }
  return null
}

/** Which other route already has pickup points in this purok (null = none). */
export function purokTakenBy(state, purok, routeId) {
  return routesForPurok(state, purok).find((r) => r.id !== routeId) ?? null
}

/** Run currently open for a truck, else that truck's latest run today. */
export function currentRunOf(state, truckId, today) {
  const runs = state.runs ?? []
  const activeId = activeRunIdOf(state, truckId)
  const active = activeId && runs.find((r) => r.id === activeId)
  if (active) return active
  return runs.find((r) => r.date === today && r.truckId === truckId) ?? null
}

export const anyRouteActive = (state) => trucksOf(state).some((t) => activeRunIdOf(state, t.id))

/** Updates one truck's session. */
export function withSession(state, truckId, fn) {
  const current = sessionOf(state, truckId)
  return { ...state, sessions: { ...(state.sessions ?? {}), [truckId]: { ...IDLE_SESSION, ...current, ...fn(current) } } }
}

export function updateTruck(state, truckId, fn) {
  return { ...state, trucks: trucksOf(state).map((t) => (t.id === truckId ? fn(t) : t)) }
}

export function updateRoute(state, routeId, fn) {
  return { ...state, routes: routesOf(state).map((r) => (r.id === routeId ? fn(r) : r)) }
}

// Shown in place of a route for a truck that has none, so older screens
// still have stops to read (none) instead of failing.
const NO_ROUTE = Object.freeze({ id: null, name: 'No route assigned', shortName: '', startTime: '', coordinatesVerified: false, stops: [] })

/**
 * Adds the single-truck fields older screens read, for the focus truck.
 * Returns a new object; the multi-truck data is not changed.
 */
export function withLegacy(state, focusTruckId = state.focusTruckId) {
  const trucks = trucksOf(state)
  const focus = trucks.find((t) => t.id === focusTruckId) ?? truckById(state, primaryTruckId(state))
  const route = (focus && routeById(state, focus.routeId)) ?? (focus ? NO_ROUTE : routesOf(state)[0] ?? NO_ROUTE)
  const session = focus ? sessionOf(state, focus.id) : IDLE_SESSION
  return {
    ...state,
    truck: focus,
    reserveTrucks: trucks.filter((t) => t !== focus),
    route: { ...route, truckId: focus?.id ?? null, driverId: focus?.driverId ?? null },
    simulation: session.simulation ?? IDLE_CONTROL,
    activeRunId: session.activeRunId ?? null,
  }
}

/** Removes the derived single-truck fields (used before saving / comparing). */
export function withoutLegacy(state) {
  const { truck: _t, reserveTrucks: _r, route: _ro, simulation: _s, activeRunId: _a, focusTruckId: _f, ...rest } = state
  return rest
}
