// What each role is allowed to see. Used by the SERVER to build each user's
// data snapshot, and by the browser to update its copy after an action.
import { currentRun } from './dataReducer.js'
import { notificationsForResident } from './selectors.js'

export const userKeyOf = (user) => (user.role === 'admin' ? 'ADMIN' : user.refId)

function withReadState(list, key) {
  return list.map((n) => {
    const readBy = (n.readBy ?? []).includes(key) ? [key] : []
    return { ...n, readBy, read: readBy.length > 0 }
  })
}

/**
 * @param {object} state  full data (server) or this user's copy (browser)
 * @param {object} user   { role: 'admin' | 'driver' | 'resident', refId }
 */
export function viewFor(state, user) {
  const key = userKeyOf(user)
  const base = {
    truck: state.truck,
    route: state.route,
    weeklySchedule: state.weeklySchedule,
    scheduleExceptions: state.scheduleExceptions ?? [],
    simulation: state.simulation,
    activeRunId: state.activeRunId,
  }

  if (user.role === 'admin') {
    return {
      ...state,
      notifications: withReadState(state.notifications.filter((n) => n.audience === 'admin' || n.audience === 'resident'), key),
    }
  }

  const publicSettings = {
    barangayName: state.settings.barangayName,
    completionTarget: state.settings.completionTarget,
    simulationIntervalMs: state.settings.simulationIntervalMs,
    officePhone: state.settings.officePhone ?? '',
  }

  if (user.role === 'driver') {
    return {
      ...base,
      settings: publicSettings,
      // Other drivers: name only. Own record: full.
      drivers: state.drivers.map((d) => (d.id === user.refId ? d : { id: d.id, name: d.name, initials: d.initials, status: d.status })),
      runs: state.runs,
      collectionFeedback: [],
      driverIssues: (state.driverIssues ?? []).filter((x) => x.driverId === user.refId),
      // Only the crew working on this driver's truck (view only).
      crew:
        state.truck.driverId === user.refId
          ? (state.crew ?? []).filter((c) => c.truckId === state.truck.id && c.status === 'active').map(({ id, name, role, photo }) => ({ id, name, role, photo: photo ?? null }))
          : [],
      notifications: withReadState(state.notifications.filter((n) => n.audience === 'driver'), key),
      residents: [],
      reports: [],
      broadcasts: [],
    }
  }

  // Resident: own profile and reports, public route info, current run status only.
  const resident = state.residents.find((r) => r.id === user.refId)
  const run = currentRun(state)
  return {
    ...base,
    settings: publicSettings,
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
    activeRunId: state.activeRunId && run?.id === state.activeRunId ? state.activeRunId : null,
    residents: resident ? [resident] : [],
    reports: state.reports.filter((r) => r.residentId === user.refId),
    collectionFeedback: (state.collectionFeedback ?? []).filter((f) => f.residentId === user.refId),
    driverIssues: [],
    crew: [],
    notifications: withReadState(notificationsForResident(state.notifications, resident), key),
    broadcasts: [],
  }
}
