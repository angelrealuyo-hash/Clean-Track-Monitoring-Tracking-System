// Read-only helpers that combine store data with the simulation.
import { isCollectionStop } from '../services/trackingSimulation.js'

export { currentRun } from './dataReducer.js'

// A stop's status: collected/missed from the saved records, "next" from the
// simulated truck. (progress = getRouteProgress(route, sim, results))
export function getStopStatus(stop, progress) {
  return progress ? progress.statusOf(stop) : 'pending'
}

export function getCollectionSummary(route, progress) {
  const stops = route.stops.filter(isCollectionStop)
  const counts = { collected: 0, missed: 0, next: 0, pending: 0 }
  for (const stop of stops) counts[getStopStatus(stop, progress)] += 1
  const total = stops.length
  return {
    total,
    ...counts,
    percent: total ? Math.round((counts.collected / total) * 100) : 0,
  }
}

// Summary of one saved run (history / analytics).
export function summarizeRun(run) {
  const results = Object.values(run.results)
  const total = run.stops.length
  const collected = results.filter((r) => r.status === 'collected').length
  const missed = results.filter((r) => r.status === 'missed').length
  return {
    total,
    collected,
    missed,
    notDone: total - collected - missed,
    percent: total ? Math.round((collected / total) * 100) : 0,
    households: run.stops.filter((s) => run.results[s.id]?.status === 'collected').reduce((n, s) => n + s.households, 0),
  }
}

export const stopStatusMeta = {
  collected: { tone: 'green', label: 'Collected' },
  missed: { tone: 'red', label: 'Missed' },
  next: { tone: 'amber', label: 'Next stop' },
  pending: { tone: 'gray', label: 'Pending' },
  depot: { tone: 'blue', label: 'Depot' },
}

export const reportStatusMeta = {
  submitted: { tone: 'red', label: 'Submitted' },
  'in-progress': { tone: 'amber', label: 'Reviewing' },
  resolved: { tone: 'green', label: 'Resolved' },
}

export const driverStatusMeta = {
  'on-shift': { tone: 'green', label: 'On shift' },
  standby: { tone: 'blue', label: 'Standby' },
  'off-duty': { tone: 'gray', label: 'Off duty / Leave' },
}

export const truckStatusMeta = {
  active: { tone: 'green', label: 'Active' },
  delayed: { tone: 'amber', label: 'Delayed' },
  standby: { tone: 'blue', label: 'Standby' },
  maintenance: { tone: 'red', label: 'In maintenance' },
}

export const priorityMeta = {
  high: { tone: 'red', label: 'High / Urgent' },
  medium: { tone: 'amber', label: 'Medium' },
  low: { tone: 'green', label: 'Low / Info' },
}

// Notifications a resident should see: messages for them personally, and
// broadcasts for their purok or the whole barangay.
export function notificationsForResident(notifications, resident) {
  if (!resident) return []
  return notifications.filter((n) => {
    if (n.audience !== 'resident') return false
    // Automatic messages the resident turned off in Profile.
    if (n.kind === 'proximity' && resident.prefs?.truckNearby === false) return false
    if (n.kind === 'schedule' && resident.prefs?.scheduleReminders === false) return false
    if (n.residentId) return n.residentId === resident.id
    if (n.zone) return n.zone === 'All Puroks' || n.zone === resident.purok
    return true
  })
}

// How far the simulated truck is from the first stop in a purok.
// Returns { state: 'not-started' | 'approaching' | 'here' | 'passed' | 'none', stopsAway, stop }
export function truckDistanceToPurok(route, sim, purok) {
  const index = route.stops.findIndex((s) => s.purok === purok)
  if (index === -1) return { state: 'none', stopsAway: null, stop: null }
  const stop = route.stops[index]
  if (sim.status === 'idle') return { state: 'not-started', stopsAway: null, stop }
  if (sim.status === 'completed' || sim.legIndex >= index) {
    const atStop = sim.legIndex === index && sim.step === 0
    return { state: atStop ? 'here' : 'passed', stopsAway: 0, stop }
  }
  const stopsAway = index - sim.legIndex - 1 // stops still to visit before this one
  return { state: stopsAway === 0 ? 'here' : 'approaching', stopsAway, stop }
}

// ---------- Resident pickup feedback (what residents SAID) ----------
// feedback: collectionFeedback records (one per resident per date, so nobody
// is counted twice for the same day). from/to: 'YYYY-MM-DD' (inclusive, optional).
export function summarizeFeedback(feedback, { from = '', to = '' } = {}) {
  const inRange = (date) => (!from || date >= from) && (!to || date <= to)
  const rows = (feedback ?? []).filter((f) => inRange(f.date))
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null)
  const count = (fn) => rows.filter(fn).length

  const willYes = count((f) => f.willDispose)
  const willNo = rows.length - willYes
  const passedYes = count((f) => f.willDispose && f.truckPassed === true)
  const passedNo = count((f) => f.willDispose && f.truckPassed === false)
  const passedUnanswered = willYes - passedYes - passedNo
  const disposedYes = count((f) => f.disposed === true)
  const disposedNo = count((f) => f.disposed === false)
  const disposedUnanswered = willYes - disposedYes - disposedNo

  const reasons = {}
  for (const f of rows) if (f.reason) reasons[f.reason] = (reasons[f.reason] ?? 0) + 1

  return {
    rows,
    responses: rows.length,
    residents: new Set(rows.map((f) => f.residentId)).size,
    days: new Set(rows.map((f) => f.date)).size,
    willYes,
    willNo,
    passedYes,
    passedNo,
    passedUnanswered,
    disposedYes,
    disposedNo,
    disposedUnanswered,
    reasons,
    percent: {
      willYes: pct(willYes, rows.length),
      passedYes: pct(passedYes, passedYes + passedNo),
      disposedYes: pct(disposedYes, disposedYes + disposedNo),
    },
  }
}

// Driver-confirmed pickups (saved stop records) for the same dates.
export function summarizeRunsInRange(runs, { from = '', to = '' } = {}) {
  const list = (runs ?? []).filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
  const totals = { runs: list.length, stops: 0, collected: 0, missed: 0, households: 0, completedRuns: 0 }
  for (const run of list) {
    const s = summarizeRun(run)
    totals.stops += s.total
    totals.collected += s.collected
    totals.missed += s.missed
    totals.households += s.households
    if (run.status === 'completed') totals.completedRuns += 1
  }
  totals.percent = totals.stops ? Math.round((totals.collected / totals.stops) * 100) : null
  return totals
}
