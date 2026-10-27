// Server-side rules for every action: WHO may do it (role permissions), WHAT
// input is valid, and which identity fields the server fills in itself (so a
// browser cannot pretend to be someone else). Returns the cleaned action plus
// side effects (accounts, emails) for the server to run after saving.
import { currentRun } from '../src/store/dataReducer.js'
import { isCollectionStop } from '../src/services/trackingSimulation.js'
import { userKeyOf } from '../src/store/view.js'
import { normalizePhone } from '../src/utils/validate.js'
import { reportCategories } from '../src/data/reports.js'
import { maintenanceTypes } from '../src/data/truck.js'
import { wasteTypes } from '../src/data/routes.js'
import { barangay } from '../src/data/barangay.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const fail = (message, status = 400) => {
  throw new HttpError(status, message)
}

// Plain addresses only (letters, digits, . _ % + -). This also blocks the
// quote/semicolon/angle-bracket tricks some email parsers mishandle.
export const SAFE_EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/

const str = (v, label, { min = 1, max = 200 } = {}) => {
  if (typeof v !== 'string') fail(`${label} is required.`)
  const s = v.trim()
  if (s.length < min) fail(`${label} is too short.`)
  if (s.length > max) fail(`${label} is too long (max ${max} characters).`)
  return s
}
const int = (v, label, min, max) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label} must be a whole number from ${min} to ${max}.`)
  return n
}
const oneOf = (v, list, label) => {
  if (!list.includes(v)) fail(`${label} is not valid.`)
  return v
}
const photo = (v) => {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(v)) fail('Photo must be an image.')
  if (v.length > 700_000) fail('Photo is too large.')
  return v
}
const email = (v, label = 'Email') => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (!s) return ''
  if (!SAFE_EMAIL.test(s)) fail(`${label} looks invalid. Use a plain address like name@example.com.`)
  return s
}
const phone = (v, label = 'Mobile number') => {
  const p = normalizePhone(String(v ?? ''))
  if (!p) fail(`${label} must be a PH mobile number, e.g. 0917 555 0192.`)
  return p
}
const time12 = /^\d{2}:\d{2} (AM|PM)$/

const ROLE_ACTIONS = {
  admin: new Set([
    'truck/update', 'truck/assignDriver', 'truck/logMaintenance',
    'driver/add', 'driver/update', 'driver/delete',
    'route/update', 'route/updateStop', 'route/addStop', 'route/removeStop', 'route/moveStop',
    'schedule/update',
    'run/start', 'run/end', 'collection/mark', 'collection/clear', 'collection/clearAll',
    'report/update', 'broadcast/add', 'settings/update',
    'notification/markRead', 'notification/markAllRead',
    'sim/start', 'sim/pause', 'sim/resume', 'sim/stop', 'sim/reset',
  ]),
  driver: new Set([
    'run/start', 'run/end', 'collection/mark', 'collection/clear', 'driver/reportIssue', 'driver/update',
    'notification/markRead', 'notification/markAllRead',
    'sim/start', 'sim/pause', 'sim/resume', 'sim/stop',
  ]),
  resident: new Set(['report/add', 'resident/update', 'notification/markRead', 'notification/markAllRead']),
}

const runActive = (state) => Boolean(state.activeRunId)

/**
 * @returns {{ action: object, effects: object[] }}
 */
export function prepareAction(state, user, action) {
  if (!action || typeof action.type !== 'string') fail('Invalid request.')
  if (!ROLE_ACTIONS[user.role]?.has(action.type)) fail('You are not allowed to do that.', 403)
  const p = action.payload ?? {}
  const effects = []
  const out = (payload) => ({ action: { type: action.type, payload }, effects })
  const driverIsAssigned = user.role === 'driver' && state.truck.driverId === user.refId
  const requireAssignedDriver = () => {
    if (user.role === 'driver' && !driverIsAssigned) fail(`You are not assigned to ${state.truck.id} today.`, 403)
  }

  switch (action.type) {
    // ---------- Truck ----------
    case 'truck/update': {
      const patch = {
        plateNumber: str(p.plateNumber, 'Plate number', { min: 2, max: 15 }).toUpperCase(),
        type: str(p.type, 'Vehicle type', { max: 40 }),
        model: typeof p.model === 'string' ? p.model.trim().slice(0, 60) : state.truck.model,
        capacityTons: (() => {
          const n = Number(p.capacityTons)
          if (!Number.isFinite(n) || n <= 0 || n > 30) fail('Capacity must be between 0.1 and 30 tons.')
          return n
        })(),
        fuel: str(p.fuel, 'Fuel type', { max: 30 }),
        status: oneOf(p.status, ['active', 'delayed', 'standby', 'maintenance'], 'Status'),
      }
      if (patch.status === 'maintenance' && runActive(state)) fail('End the current route before putting the truck in maintenance.', 409)
      return out(patch)
    }
    case 'truck/assignDriver': {
      const driverId = p.driverId ?? null
      if (driverId !== null && !state.drivers.some((d) => d.id === driverId)) fail('That driver does not exist.')
      if (runActive(state) && driverId !== state.truck.driverId) fail('A route is in progress. End it before changing the driver.', 409)
      return out({ driverId })
    }
    case 'truck/logMaintenance': {
      const km = int(p.odometerKm, 'Odometer', state.truck.odometerKm, 2_000_000)
      const date = str(p.date, 'Service date', { max: 10 })
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Service date is not valid.')
      const next = p.nextServiceDate ? String(p.nextServiceDate) : ''
      if (next && (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next <= date)) fail('Next service must be after the service date.')
      const newStatus = oneOf(p.newStatus, ['active', 'delayed', 'standby', 'maintenance'], 'Status')
      if (newStatus === 'maintenance' && runActive(state)) fail('End the current route before putting the truck in maintenance.', 409)
      return out({
        type: oneOf(p.type, maintenanceTypes, 'Maintenance type'),
        odometerKm: km,
        date,
        newStatus,
        nextServiceDate: next,
        notes: typeof p.notes === 'string' ? p.notes.trim().slice(0, 300) : '',
      })
    }

    // ---------- Drivers ----------
    case 'driver/add': {
      const e = email(p.email, 'Driver email')
      const driver = {
        name: str(p.name, 'Driver name', { min: 3, max: 60 }).replace(/\s+/g, ' '),
        phone: phone(p.phone),
        license: str(p.license, 'License type', { max: 60 }),
        shift: str(p.shift, 'Shift', { max: 60 }),
        status: oneOf(p.status ?? 'standby', ['on-shift', 'standby', 'off-duty'], 'Availability'),
        ...(e ? { email: e } : {}),
      }
      if (p.password) {
        if (!e) fail('Add an email so the driver can sign in.')
        if (String(p.password).length < 6) fail('Driver password must be at least 6 characters.')
        effects.push({ type: 'createDriverAccount', email: e, phone: driver.phone, password: String(p.password) })
      }
      return out(driver)
    }
    case 'driver/update': {
      const target = state.drivers.find((d) => d.id === p.id)
      if (!target) fail('That driver does not exist.', 404)
      const patchIn = p.patch ?? {}
      if (user.role === 'driver') {
        // Drivers may only change their own availability (start/end shift).
        if (p.id !== user.refId) fail('You can only update your own status.', 403)
        const keys = Object.keys(patchIn)
        if (keys.some((k) => k !== 'status')) fail('You can only change your shift status.', 403)
      }
      const patch = {}
      if ('name' in patchIn) patch.name = str(patchIn.name, 'Driver name', { min: 3, max: 60 }).replace(/\s+/g, ' ')
      if ('phone' in patchIn) patch.phone = phone(patchIn.phone)
      if ('license' in patchIn) patch.license = str(patchIn.license, 'License type', { max: 60 })
      if ('shift' in patchIn) patch.shift = str(patchIn.shift, 'Shift', { max: 60 })
      if ('email' in patchIn) {
        const e = email(patchIn.email, 'Driver email')
        patch.email = e
        effects.push({ type: 'updateDriverAccount', driverId: p.id, fields: { email: e || null } })
      }
      if ('status' in patchIn) {
        patch.status = oneOf(patchIn.status, ['on-shift', 'standby', 'off-duty'], 'Availability')
        if (patch.status === 'off-duty' && runActive(state) && state.truck.driverId === p.id && user.role === 'admin')
          fail('This driver has a route in progress. End the route first.', 409)
      }
      if (user.role === 'admin' && 'account' in patchIn) {
        const account = oneOf(patchIn.account, ['active', 'disabled'], 'Account status')
        effects.push({ type: 'updateDriverAccount', driverId: p.id, fields: { active: account === 'active' ? 1 : 0 } })
      }
      if (user.role === 'admin' && patchIn.password) {
        if (String(patchIn.password).length < 6) fail('Password must be at least 6 characters.')
        effects.push({ type: 'setDriverPassword', driverId: p.id, email: patch.email ?? target.email, phone: patch.phone ?? target.phone, password: String(patchIn.password) })
      }
      return out({ id: p.id, patch })
    }
    case 'driver/delete': {
      if (!state.drivers.some((d) => d.id === p.id)) fail('That driver does not exist.', 404)
      if (runActive(state) && state.truck.driverId === p.id) fail('This driver has a route in progress. End the route first.', 409)
      effects.push({ type: 'disableDriverAccount', driverId: p.id })
      return out({ id: p.id })
    }

    // ---------- Route & schedule ----------
    case 'route/update': {
      const start = str(p.startTime, 'Start time', { max: 8 })
      if (!time12.test(start)) fail('Start time is not valid.')
      return out({ name: str(p.name, 'Route name', { min: 3, max: 80 }), shortName: str(p.shortName, 'Short name', { max: 40 }), startTime: start })
    }
    case 'route/updateStop': {
      const stop = state.route.stops.find((s) => s.id === p.id)
      if (!stop) fail('That stop does not exist.', 404)
      const patchIn = p.patch ?? {}
      const patch = { name: str(patchIn.name, 'Stop name', { min: 3, max: 80 }) }
      if (isCollectionStop(stop)) {
        patch.purok = oneOf(patchIn.purok, barangay.puroks, 'Purok')
        patch.households = int(patchIn.households, 'Households', 1, 500)
      }
      return out({ id: p.id, patch })
    }
    case 'route/addStop': {
      const coords = p.coords
      if (!Array.isArray(coords) || coords.length !== 2 || !coords.every(Number.isFinite)) fail('Pick the stop location on the map.')
      if (Math.abs(coords[0]) > 90 || Math.abs(coords[1]) > 180) fail('That location is not valid.')
      if (!state.route.stops.some((s) => s.id === p.afterId)) fail('Choose where the stop goes in the route.')
      return out({
        name: str(p.name, 'Stop name', { min: 3, max: 80 }),
        purok: oneOf(p.purok, barangay.puroks, 'Purok'),
        households: int(p.households, 'Households', 1, 500),
        coords: [Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6))],
        afterId: p.afterId,
      })
    }
    case 'route/removeStop':
    case 'route/moveStop':
      if (!state.route.stops.some((s) => s.id === p.id)) fail('That stop does not exist.', 404)
      return out(action.type === 'route/moveStop' ? { id: p.id, dir: p.dir === -1 ? -1 : 1 } : { id: p.id })
    case 'schedule/update': {
      if (!state.weeklySchedule.some((d) => d.day === p.day)) fail('That day does not exist.')
      const wasteType = oneOf(p.patch?.wasteType, wasteTypes, 'Waste type')
      const window = wasteType === 'No collection' ? '-' : str(p.patch?.window, 'Time window', { max: 25 })
      if (window !== '-') {
        const [a, b] = window.split(' - ')
        if (!time12.test(a ?? '') || !time12.test(b ?? '')) fail('Time window is not valid.')
      }
      return out({ day: p.day, patch: { wasteType, window } })
    }

    // ---------- Collection runs ----------
    case 'run/start': {
      requireAssignedDriver()
      if (state.truck.status === 'maintenance') fail(`Truck ${state.truck.id} is in maintenance. The route cannot start.`, 409)
      if (!state.route.stops.some(isCollectionStop)) fail('The route has no pickup points.', 409)
      return out(user.role === 'driver' ? { by: 'driver', driverId: user.refId } : { by: 'admin' })
    }
    case 'run/end':
      requireAssignedDriver()
      return out({})
    case 'collection/mark': {
      requireAssignedDriver()
      const stop = state.route.stops.find((s) => s.id === p.stopId)
      if (!stop || !isCollectionStop(stop)) fail('That pickup point does not exist.', 404)
      const status = oneOf(p.status, ['collected', 'missed'], 'Status')
      const note = typeof p.note === 'string' ? p.note.trim().slice(0, 300) : ''
      if (status === 'missed' && note.length < 3) fail('Give a reason when a stop is missed.')
      const driver = state.drivers.find((d) => d.id === user.refId)
      return out({
        stopId: p.stopId,
        status,
        note,
        bags: p.bags === undefined || p.bags === null ? null : int(p.bags, 'Bags', 0, 500),
        by: user.role,
        byName: user.role === 'driver' ? driver?.name ?? 'Driver' : user.name ?? 'Barangay office',
      })
    }
    case 'collection/clear': {
      requireAssignedDriver()
      const rec = currentRun(state)?.results[p.stopId]
      if (!rec) fail('There is no record to undo.', 404)
      if (user.role === 'driver' && rec.by !== 'driver') fail('Only the office can change records made by the office.', 403)
      return out({ stopId: p.stopId })
    }
    case 'collection/clearAll':
      return out({})
    case 'driver/reportIssue': {
      requireAssignedDriver()
      const stop = state.route.stops.find((s) => s.id === p.stopId)
      if (!stop) fail('That stop does not exist.', 404)
      const driver = state.drivers.find((d) => d.id === user.refId)
      return out({
        stopId: stop.id,
        stopName: stop.name,
        issueType: str(p.issueType ?? 'other', 'Issue type', { max: 30 }),
        issueLabel: str(p.issueLabel, 'Issue type', { max: 60 }),
        description: str(p.description, 'Description', { min: 10, max: 250 }),
        photo: photo(p.photo),
        notifyDispatch: Boolean(p.notifyDispatch),
        markMissed: Boolean(p.markMissed),
        driverName: driver?.name ?? 'Driver',
      })
    }

    // ---------- Reports ----------
    case 'report/add': {
      const resident = state.residents.find((r) => r.id === user.refId)
      if (!resident) fail('Your account was not found.', 404)
      const category = reportCategories.find((c) => c.id === p.category)
      if (!category) fail('Choose what the problem is.')
      return out({
        // The server always decides who sent it.
        residentId: resident.id,
        residentName: resident.name,
        residentPhone: resident.phone,
        category: category.id,
        categoryLabel: category.label,
        location: str(p.location, 'Location', { min: 3, max: 200 }),
        description: typeof p.description === 'string' && p.description.trim() ? p.description.trim().slice(0, 250) : `${category.label}.`,
        photo: photo(p.photo),
        smsUpdates: Boolean(p.smsUpdates),
      })
    }
    case 'report/update': {
      const report = state.reports.find((r) => r.id === p.id)
      if (!report) fail('That report does not exist.', 404)
      const status = p.status ? oneOf(p.status, ['submitted', 'in-progress', 'resolved'], 'Status') : undefined
      const adminResponse = p.adminResponse === undefined ? undefined : p.adminResponse ? str(p.adminResponse, 'Response', { max: 400 }) : null
      if ((status ?? report.status) === 'resolved' && !(adminResponse ?? report.adminResponse))
        fail('Write a response before marking the report resolved.')
      const labels = { submitted: 'Submitted', 'in-progress': 'Reviewing', resolved: 'Resolved' }
      effects.push({ type: 'emailReportUpdate', reportId: report.id })
      return out({ id: p.id, ...(status ? { status, statusLabel: labels[status] } : {}), ...(adminResponse !== undefined ? { adminResponse } : {}) })
    }

    // ---------- Residents ----------
    case 'resident/update': {
      if (p.id !== user.refId) fail('You can only edit your own profile.', 403)
      const patchIn = p.patch ?? {}
      const patch = {}
      if ('name' in patchIn) {
        patch.name = str(patchIn.name, 'Full name', { min: 3, max: 60 }).replace(/\s+/g, ' ')
        if (patch.name.split(' ').length < 2) fail('Enter your first and last name.')
      }
      if ('phone' in patchIn) {
        patch.phone = phone(patchIn.phone)
        effects.push({ type: 'updateResidentAccount', residentId: user.refId, fields: { phone: patch.phone } })
      }
      if ('email' in patchIn) {
        patch.email = email(patchIn.email)
        effects.push({ type: 'updateResidentAccount', residentId: user.refId, fields: { email: patch.email || null } })
      }
      if ('address' in patchIn) patch.address = str(patchIn.address, 'Address', { min: 3, max: 120 })
      if ('purok' in patchIn) patch.purok = oneOf(patchIn.purok, barangay.puroks, 'Purok')
      if ('prefs' in patchIn) {
        const prefs = patchIn.prefs ?? {}
        patch.prefs = Object.fromEntries(['email', 'push', 'scheduleReminders', 'truckNearby'].map((k) => [k, Boolean(prefs[k])]))
      }
      return out({ id: user.refId, patch })
    }

    // ---------- Notifications ----------
    case 'notification/markRead':
      return out({ id: String(p.id ?? ''), userKey: userKeyOf(user) })
    case 'notification/markAllRead':
      return out({
        ...(Array.isArray(p.ids) ? { ids: p.ids.map(String) } : { audience: user.role === 'resident' ? 'resident' : user.role }),
        userKey: userKeyOf(user),
      })
    case 'broadcast/add': {
      const zone = oneOf(p.zone, ['All Puroks', ...barangay.puroks], 'Recipient zone')
      const wantsEmail = Array.isArray(p.channels) && p.channels.includes('Email')
      const payload = {
        zone,
        subject: str(p.subject, 'Subject', { min: 4, max: 80 }),
        message: str(p.message, 'Message', { min: 10, max: 300 }),
        channels: wantsEmail ? ['App', 'Email'] : ['App'],
      }
      if (wantsEmail) effects.push({ type: 'emailBroadcast' })
      return out(payload)
    }

    // ---------- Settings & demo truck ----------
    case 'settings/update': {
      const patch = {}
      // Optional: empty means no barangay name is shown.
      if ('barangayName' in p) {
        const name = typeof p.barangayName === 'string' ? p.barangayName.trim() : ''
        if (name && (name.length < 3 || name.length > 60)) fail('Barangay name must be 3 to 60 characters, or empty.')
        patch.barangayName = name
      }
      if ('completionTarget' in p) patch.completionTarget = int(p.completionTarget, 'Completion target', 50, 100)
      if ('simulationIntervalMs' in p) patch.simulationIntervalMs = Number(oneOf(Number(p.simulationIntervalMs), [1000, 2000, 5000], 'Update interval'))
      if ('autoProximityAlerts' in p) patch.autoProximityAlerts = Boolean(p.autoProximityAlerts)
      if ('autoScheduleReminders' in p) patch.autoScheduleReminders = Boolean(p.autoScheduleReminders)
      return out(patch)
    }
    case 'sim/start':
    case 'sim/pause':
    case 'sim/resume':
    case 'sim/stop':
    case 'sim/reset':
      if (user.role === 'driver') requireAssignedDriver()
      return out(action.type === 'sim/start' ? { force: Boolean(p.force) } : {})

    default:
      return fail('Unknown action.')
  }
}
