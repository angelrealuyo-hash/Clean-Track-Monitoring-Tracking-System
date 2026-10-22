// Read-only helpers that combine store data with the simulation.
import { isCollectionStop } from '../services/trackingSimulation.js'

// A stop's status for today. A result the admin set by hand (Collection
// Monitoring) wins over the simulation.
// 'collected' | 'missed' | 'next' | 'pending' | 'depot'
export function getStopStatus(stop, progress, collectionLog) {
  const manual = collectionLog[stop.id]
  if (manual) return manual.status
  return progress ? progress.statusOf(stop) : 'pending'
}

export function getCollectionSummary(route, progress, collectionLog) {
  const stops = route.stops.filter(isCollectionStop)
  const counts = { collected: 0, missed: 0, next: 0, pending: 0 }
  for (const stop of stops) counts[getStopStatus(stop, progress, collectionLog)] += 1
  const total = stops.length
  return {
    total,
    ...counts,
    percent: total ? Math.round((counts.collected / total) * 100) : 0,
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
  submitted: { tone: 'red', label: 'New' },
  'in-progress': { tone: 'amber', label: 'In progress' },
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
