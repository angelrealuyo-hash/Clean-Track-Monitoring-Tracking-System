// The starting demo data for the store, built from the files in /data.
// "Reset demo data" in Settings returns to exactly this.
import { barangay } from '../data/barangay.js'
import { truck } from '../data/truck.js'
import { drivers } from '../data/drivers.js'
import { route, weeklySchedule } from '../data/routes.js'
import { reports } from '../data/reports.js'
import { notifications, residentBroadcasts } from '../data/notifications.js'
import { demoUsers } from '../data/users.js'

export const DATA_VERSION = 1

export const defaultSettings = {
  barangayName: barangay.name,
  lguCode: 'LGU-NCR-DEMO-01',
  timezone: 'Asia/Manila',
  operatingStart: '05:00',
  operatingEnd: '20:00',
  completionTarget: 90, // % of stops that should be collected each day
  missedGraceMinutes: 15,
  simulationIntervalMs: 1000,
  notifyDelays: true,
  notifyMissedReports: true,
  notifyOverflow: true,
  dailyDigest: false,
  alertSound: false,
}

const clone = (v) => structuredClone(v)

export function createInitialData() {
  return {
    version: DATA_VERSION,
    truck: clone(truck),
    drivers: clone(drivers),
    route: clone(route),
    weeklySchedule: clone(weeklySchedule),
    reports: clone(reports).map((r) => ({
      ...r,
      residentName: r.residentId === demoUsers.resident.id ? demoUsers.resident.name : 'Resident',
      residentPhone: r.residentId === demoUsers.resident.id ? demoUsers.resident.phone : null,
      history: [{ at: r.submittedAt, text: 'Report submitted by resident' }],
    })),
    notifications: clone(notifications),
    broadcasts: clone(residentBroadcasts).map((b) => ({ ...b, message: '' })),
    // Manual stop results set by the admin today: { [stopId]: { status, note, at } }
    collectionLog: {},
    settings: { ...defaultSettings },
    savedAt: null,
  }
}
