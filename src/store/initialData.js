// The starting demo data for the store, built from the files in /data.
// "Reset demo data" in Settings returns to exactly this.
import { barangay } from '../data/barangay.js'
import { truck } from '../data/truck.js'
import { drivers } from '../data/drivers.js'
import { route, weeklySchedule } from '../data/routes.js'
import { reports } from '../data/reports.js'
import { notifications, residentBroadcasts } from '../data/notifications.js'
import { demoUsers } from '../data/users.js'
import { IDLE_CONTROL } from '../services/trackingSimulation.js'
import { withLegacy } from './fleet.js'

// Bump when the saved shape changes; older saved data is replaced.
export const DATA_VERSION = 3

// Only settings the app actually uses.
export const defaultSettings = {
  barangayName: barangay.name,
  completionTarget: 90, // % of pickup points that should be collected each run
  simulationIntervalMs: 1000, // how often the demo truck moves
  autoProximityAlerts: true, // in-app "truck is coming" message per purok
  autoScheduleReminders: true, // in-app "pickup today" message on pickup days
  autoPickupCheck: true, // in-app "Today's Pick Up Check!" question on pickup days
  // Office number for the Driver app's "Call the Office" button. Empty until
  // the admin enters the real number in Settings (no number is made up).
  officePhone: '',
}

const clone = (v) => structuredClone(v)

export const defaultResidentPrefs = { email: true, push: true, scheduleReminders: true, truckNearby: true }

export function createInitialData() {
  // The demo route's truck and driver come from the truck record, not the route.
  const { truckId: _truck, driverId: _driver, ...demoRoute } = clone(route)
  return withLegacy({
    version: DATA_VERSION,
    // Every registered truck. Each can have its own route, driver on duty and
    // crew (see src/store/fleet.js); trucks added later start with none.
    trucks: [clone(truck)],
    drivers: clone(drivers),
    // Every collection route. One purok's pickup points are on one route only.
    routes: [demoRoute],
    weeklySchedule: clone(weeklySchedule),
    // Holidays / suspended pickup dates (none until the admin adds them).
    scheduleExceptions: [],
    // Resident accounts. The demo resident is first; "Create Account" adds more.
    // Resident profiles. Passwords are NOT stored here: sign-in accounts live in
    // the server's accounts table with hashed passwords.
    residents: [
      (({ password: _pw, ...profile }) => ({ ...profile, prefs: { ...defaultResidentPrefs }, createdAt: '2024-09-01T08:00:00' }))(
        clone(demoUsers.resident),
      ),
    ],
    reports: clone(reports).map((r) => ({
      ...r,
      photo: null,
      smsUpdates: true,
      residentName: r.residentId === demoUsers.resident.id ? demoUsers.resident.name : 'Resident',
      residentPhone: r.residentId === demoUsers.resident.id ? demoUsers.resident.phone : null,
      history: [{ at: r.submittedAt, text: 'Report submitted by resident' }],
    })),
    // Seed "read" flags become per-person read state for the demo accounts.
    notifications: clone(notifications).map(({ read, ...n }) => ({
      ...n,
      readBy: read ? [n.audience === 'admin' ? 'ADMIN' : n.audience === 'driver' ? 'DRV-01' : demoUsers.resident.id] : [],
    })),
    broadcasts: clone(residentBroadcasts).map((b) => ({ ...b, message: '' })),
    // Saved collection runs: one per Start Route (see store/dataReducer.js).
    // Each run keeps every pickup point's result, so history and analytics
    // come from real records instead of made-up numbers.
    runs: [],
    // Resident answers to "Will you put out your garbage today?" (one per
    // resident per pickup date). What residents SAID, not confirmed pickups.
    collectionFeedback: [],
    // Problems reported by the driver (from Home or a stop).
    driverIssues: [],
    // Truck crew members besides the driver (Admin → Crew Management).
    crew: [],
    // One entry per truck: its demo GPS controls (the position is calculated
    // from these + the clock) and its route run in progress.
    sessions: { [truck.id]: { simulation: { ...IDLE_CONTROL }, activeRunId: null } },
    settings: { ...defaultSettings },
    savedAt: null,
  })
}
