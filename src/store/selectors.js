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
