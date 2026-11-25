// What each role is allowed to see. Used by the SERVER to build each user's
// data snapshot.
//
// Several trucks operate independently (src/store/fleet.js):
//   - the office sees every truck;
//   - a driver sees only the truck they drive (else the truck whose shift
//     roster they are on), with its route, demo GPS, runs and crew;
//   - a resident sees only the truck serving their purok (one purok, one truck).
// Each view also says which truck is its focus, so the single-truck fields
// older screens read (`truck`, `route`, `simulation`, `activeRunId`) describe
// that truck.
import { currentRun } from './dataReducer.js'
import { notificationsForResident } from './selectors.js'
import { primaryTruckId, rosterTruckOfDriver, routeOfTruck, sessionOf, truckById, truckForPurok, truckOfDriver, withLegacy, withoutLegacy } from './fleet.js'

export const userKeyOf = (user) => (user.role === 'admin' ? 'ADMIN' : user.refId)

function withReadState(list, key) {
  return list.map((n) => {
    const readBy = (n.readBy ?? []).includes(key) ? [key] : []
    return { ...n, readBy, read: readBy.length > 0 }
  })
}

// One truck with its route and session (what a driver or resident may see).
function oneTruck(state, truck) {
  if (!truck) return { trucks: [], routes: [], sessions: {}, focusTruckId: null }
  const route = routeOfTruck(state, truck.id)
  return {
    trucks: [truck],
    routes: route ? [route] : [],
    sessions: { [truck.id]: sessionOf(state, truck.id) },
    focusTruckId: truck.id,
  }
}

/**
 * @param {object} full  the server's full data
 * @param {object} user  { role: 'admin' | 'driver' | 'resident', refId }
 */
export function viewFor(full, user) {
  const state = withoutLegacy(full)
  const key = userKeyOf(user)

  if (user.role === 'admin') {
    return withLegacy({
      ...state,
      notifications: withReadState(state.notifications.filter((n) => n.audience === 'admin' || n.audience === 'resident'), key),
    })
  }

  const shared = {
    weeklySchedule: state.weeklySchedule,
    scheduleExceptions: state.scheduleExceptions ?? [],
    settings: {
      barangayName: state.settings.barangayName,
      completionTarget: state.settings.completionTarget,
      simulationIntervalMs: state.settings.simulationIntervalMs,
      officePhone: state.settings.officePhone ?? '',
    },
  }

  if (user.role === 'driver') {
    const driving = truckOfDriver(state, user.refId)
    // Not on duty: the truck whose roster they are on (they cannot start its
    // route). Not on any roster yet: the first truck, so the app can say so.
    const truck = driving ?? rosterTruckOfDriver(state, user.refId) ?? truckById(state, primaryTruckId(state))
    const own = state.drivers.find((d) => d.id === user.refId)
    return withLegacy({
      ...shared,
      ...oneTruck(state, truck),
      // Other drivers: name only. Own record: full.
      drivers: state.drivers.map((d) => (d.id === user.refId ? d : { id: d.id, name: d.name, initials: d.initials, status: d.status })),
      runs: truck ? state.runs.filter((r) => r.truckId === truck.id) : [],
      collectionFeedback: [],
      driverIssues: (state.driverIssues ?? []).filter((x) => x.driverId === user.refId),
      // Only the active crew on this driver's truck and shift (view only).
      crew: driving
        ? (state.crew ?? [])
            .filter((c) => c.truckId === driving.id && c.status === 'active' && c.shift === own?.shift)
            .map(({ id, name, role, photo }) => ({ id, name, role, photo: photo ?? null }))
        : [],
      // Messages for all drivers, and messages about their own truck.
      notifications: withReadState(state.notifications.filter((n) => n.audience === 'driver' && (!n.truckId || n.truckId === truck?.id)), key),
      residents: [],
      reports: [],
      broadcasts: [],
    })
  }

  // Resident: own profile and reports, and only the truck serving their purok:
  // its route, demo GPS and current run status.
  const resident = state.residents.find((r) => r.id === user.refId)
  // No truck serves the purok yet: the first truck, until the Resident app
  // says so itself (planned Phase 6). Today every purok is on a route.
  const truck = truckForPurok(state, resident?.purok) ?? truckById(state, primaryTruckId(state))
  const run = truck ? currentRun(state, truck.id) : null
  const activeRunId = truck ? sessionOf(state, truck.id).activeRunId : null
  return withLegacy({
    ...shared,
    ...oneTruck(state, truck),
    drivers: state.drivers.map((d) => ({ id: d.id, name: d.name, initials: d.initials })),
    runs: run
      ? [
          {
            ...run,
            driverName: run.driverName,
            results: Object.fromEntries(Object.entries(run.results).map(([id, r]) => [id, { status: r.status, at: r.at, simAt: r.simAt }])),
          },
        ]
      : [],
    // The open run only (an earlier day's leftover run is not shown as active).
    ...(truck ? { sessions: { [truck.id]: { ...sessionOf(state, truck.id), activeRunId: activeRunId && run?.id === activeRunId ? activeRunId : null } } } : {}),
    residents: resident ? [resident] : [],
    reports: state.reports.filter((r) => r.residentId === user.refId),
    collectionFeedback: (state.collectionFeedback ?? []).filter((f) => f.residentId === user.refId),
    driverIssues: [],
    crew: [],
    notifications: withReadState(notificationsForResident(state.notifications, resident), key),
    broadcasts: [],
  })
}
