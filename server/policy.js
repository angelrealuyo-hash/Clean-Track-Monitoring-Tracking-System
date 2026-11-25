// Server-side rules for every action: WHO may do it (role permissions), WHAT
// input is valid, and which identity fields the server fills in itself (so a
// browser cannot pretend to be someone else). Returns the cleaned action plus
// side effects (accounts, emails) for the server to run after saving.
import { currentRun } from '../src/store/dataReducer.js'
import { isCollectionStop } from '../src/services/trackingSimulation.js'
import { userKeyOf } from '../src/store/view.js'
import { normalizePhone } from '../src/utils/validate.js'
import { reportCategories } from '../src/data/reports.js'
import {
  MAX_TRUCKS,
  MIN_TRUCK_YEAR,
  RESERVE_STATUSES,
  allTrucks,
  findTruck,
  isOutOfService,
  joinModel,
  maintenanceTypes,
  maxTruckYear,
  plateKey,
  statusesForTruck,
  truckDeleteBlock,
  truckIdKey,
} from '../src/data/truck.js'
import {
  activeRunIdOf,
  isMoving,
  primaryTruckId,
  purokTakenBy,
  rosterTruckOfDriver,
  routeById,
  routeOfStop,
  routeOfTruck,
  routesOf,
  simulationOf,
  truckById,
  truckForPurok,
  truckOfDriver,
  truckOfRoute,
  truckOfStop,
} from '../src/store/fleet.js'
import { COLLECTION, exceptionKinds, exceptionOn, isCollectionDate, isCollectionDay, isPickupDate, scheduleLabel } from '../src/data/schedule.js'
import { barangay } from '../src/data/barangay.js'
import { feedbackReasons } from '../src/data/collectionFeedback.js'
import { crewRoles } from '../src/data/crew.js'
import { phHolidayOn } from '../src/resident/data/phHolidays.js'
import { SHIFT_KEYS, collectorsOf, fullMessage, hasRoom, holdsSlot, sameName } from '../src/data/personnel.js'
import { todayISO, todayName } from '../src/utils/format.js'

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
const isRef = (v) => typeof v === 'string' && /^upl:[a-f0-9]{32}$/.test(v)

// Profile pictures: a new image (data URL), null to remove, or the current
// picture unchanged ("upl:<id>" it already had).
const profilePhoto = (v, current) => {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (isRef(v) && v === current) return v
  return photo(v)
}

const ROLE_ACTIONS = {
  admin: new Set([
    'truck/add', 'truck/update', 'truck/delete', 'truck/setService', 'truck/assignRoute', 'truck/assignDriver', 'truck/logMaintenance',
    'driver/add', 'driver/update', 'driver/delete',
    'route/add', 'route/delete', 'route/update', 'route/updateStop', 'route/addStop', 'route/removeStop', 'route/moveStop',
    'schedule/update',
    'run/start', 'run/end', 'collection/mark', 'collection/clear', 'collection/clearAll',
    'report/update', 'broadcast/add', 'settings/update',
    'crew/add', 'crew/update', 'crew/delete', 'admin/setPhoto',
    'schedule/addException', 'schedule/removeException',
    'notification/markRead', 'notification/markAllRead',
    'sim/start', 'sim/pause', 'sim/resume', 'sim/stop', 'sim/reset',
  ]),
  driver: new Set([
    'run/start', 'run/end', 'collection/mark', 'collection/clear', 'driver/reportIssue', 'driver/update',
    'notification/markRead', 'notification/markAllRead',
    'sim/start', 'sim/pause', 'sim/resume', 'sim/stop',
  ]),
  resident: new Set(['report/add', 'feedback/submit', 'resident/update', 'notification/markRead', 'notification/markAllRead']),
}

// Is this truck's route in progress?
const runActiveOn = (state, truckId) => Boolean(truckId && activeRunIdOf(state, truckId))

const bool = (v, label) => {
  if (typeof v !== 'boolean') fail(`${label} must be Active or Inactive.`)
  return v
}

// ---------- Truck personnel (limits in src/data/personnel.js) ----------
// Works out a person's roster place { truckId, shift } and checks that truck's
// shift limit whenever they would take a slot they do not already hold.
// Editing a name, number or picture never re-checks the limit, and the
// person's own current slot is left out of the count. Inactive people take no
// slot. Every truck has its own Morning and Afternoon Shift.
function rosterPlace(state, { type, key, current, shiftIn, active, required, truckId }) {
  let shift
  if (shiftIn === undefined) {
    if (required) fail('Choose the Morning or Afternoon shift.')
    shift = current?.shift ?? null
  } else if (shiftIn === null || shiftIn === '') {
    if (required) fail('Choose the Morning or Afternoon shift.')
    shift = null
  } else shift = oneOf(shiftIn, SHIFT_KEYS, 'Shift')
  const place = { truckId: shift ? truckId : null, shift }
  const takesSlot = holdsSlot({ ...place, active }, truckId)
  const keepsSameSlot = current && holdsSlot(current, truckId) && current.shift === shift
  if (takesSlot && !keepsSameSlot && !hasRoom(state, type, shift, { excludeKey: key, truckId })) fail(fullMessage(type, shift), 409)
  return place
}

// The truck a person is placed on: the one sent (admin), else their current
// truck, else the first truck with a route (older screens send none).
function rosterTruckId(state, truckIdIn, current) {
  if (truckIdIn !== undefined && truckIdIn !== null && truckIdIn !== '') {
    if (!truckById(state, truckIdIn)) fail('That truck does not exist.', 404)
    return truckIdIn
  }
  return current?.truckId ?? primaryTruckId(state)
}

// One purok, one truck: a purok's pickup points stay on one route.
function checkPurokFree(state, purok, routeId) {
  const other = purokTakenBy(state, purok, routeId)
  if (other) {
    const owner = truckOfRoute(state, other.id)
    fail(`${purok} is already served by ${other.name}${owner ? ` (${owner.id})` : ''}. One purok is served by one truck.`, 409)
  }
}

// The same person may not be listed twice (e.g. a form sent twice).
function checkNotListed(state, name, key) {
  if (collectorsOf(state).some((c) => c.key !== key && sameName(c.name, name))) fail(`${name} is already on the collectors list.`, 409)
}

// ---------- Trucks ----------
const isoDate = (v, label) => {
  const s = String(v ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00`))) fail(`${label} is not a valid date.`)
  return s
}
const outOfServiceWord = (status) => (status === 'inactive' ? 'inactive' : 'in maintenance')
const truckStatusWord = (status) => ({ inactive: 'inactive', maintenance: 'under maintenance' })[status] ?? status

// Vehicle details shared by Add Truck and Edit Truck. `current` is the truck
// being edited (null when adding); it is left out of the duplicate check.
function truckDetails(state, p, current, statuses) {
  const plateNumber = str(p.plateNumber, 'Plate number', { min: 2, max: 15 }).toUpperCase().replace(/\s+/g, ' ')
  if (plateKey(plateNumber).length < 2) fail('Plate number is not valid.')
  const clash = allTrucks(state).find((t) => t !== current && t.id !== current?.id && plateKey(t.plateNumber) === plateKey(plateNumber))
  if (clash) fail(`Plate number ${plateNumber} is already registered to ${clash.id}.`, 409)
  let model
  if (p.year !== undefined) {
    // Year and model sent separately (Add/Edit Truck form).
    const year = p.year === '' || p.year === null ? '' : String(int(p.year, 'Year', MIN_TRUCK_YEAR, maxTruckYear()))
    model = joinModel(year, typeof p.model === 'string' ? p.model.slice(0, 50) : '')
  } else {
    model = typeof p.model === 'string' ? p.model.trim().slice(0, 60) : current?.model ?? ''
  }
  return {
    plateNumber,
    type: str(p.type, 'Vehicle type', { max: 40 }),
    model,
    capacityTons: (() => {
      const n = Number(p.capacityTons)
      if (!Number.isFinite(n) || n <= 0 || n > 30) fail('Capacity must be between 0.1 and 30 tons.')
      return n
    })(),
    fuel: str(p.fuel, 'Fuel type', { max: 30 }),
    status: oneOf(p.status, statuses, 'Status'),
  }
}

/**
 * @returns {{ action: object, effects: object[] }}
 */
export function prepareAction(state, user, action) {
  if (!action || typeof action.type !== 'string') fail('Invalid request.')
  if (!ROLE_ACTIONS[user.role]?.has(action.type)) fail('You are not allowed to do that.', 403)
  const p = action.payload ?? {}
  const effects = []
  const out = (payload) => ({ action: { type: action.type, payload }, effects })
  // The truck an action is about. A driver only ever works on the truck they
  // are on duty for (whatever truck the request names); the office may name
  // any truck, and older screens that name none mean the first truck with a route.
  const truckFor = (truckIdIn) => {
    if (user.role === 'driver') {
      const own = truckOfDriver(state, user.refId)
      if (!own) fail(`You are not assigned to ${rosterTruckOfDriver(state, user.refId)?.id ?? 'a truck'} today.`, 403)
      if (truckIdIn !== undefined && truckIdIn !== null && truckIdIn !== own.id) fail('You can only work on your own truck.', 403)
      return own
    }
    const t = truckById(state, truckIdIn ?? primaryTruckId(state))
    if (!t) fail('That truck does not exist.', 404)
    return t
  }

  switch (action.type) {
    // ---------- Truck ----------
    case 'truck/add': {
      if (allTrucks(state).length >= MAX_TRUCKS) fail(`CleanTrack keeps up to ${MAX_TRUCKS} trucks. Delete an unused truck first.`, 409)
      const id = truckIdKey(str(p.id, 'Truck ID', { min: 2, max: 12 }))
      if (!/^[A-Z0-9][A-Z0-9-]*$/.test(id)) fail('Truck ID may only use letters, numbers and dashes (e.g. TRK-02).')
      if (allTrucks(state).some((t) => truckIdKey(t.id) === id)) fail(`Truck ID ${id} is already registered.`, 409)
      const details = truckDetails(state, p, null, RESERVE_STATUSES)
      return out({
        id,
        ...details,
        odometerKm: p.odometerKm === undefined || p.odometerKm === '' ? 0 : int(p.odometerKm, 'Odometer', 0, 2_000_000),
        nextServiceDate: p.nextServiceDate ? isoDate(p.nextServiceDate, 'Next service') : null,
      })
    }
    case 'truck/update': {
      // No id: the first truck with a route (older screens and API tests send none).
      const target = p.id === undefined ? truckById(state, primaryTruckId(state)) : findTruck(state, p.id)
      if (!target) fail('That truck does not exist.', 404)
      const patch = truckDetails(state, p, target, statusesForTruck(target))
      if (isOutOfService(patch.status) && runActiveOn(state, target.id))
        fail(`End the current route before marking the truck ${outOfServiceWord(patch.status)}.`, 409)
      return out({ id: target.id, ...patch })
    }
    case 'truck/delete': {
      const target = findTruck(state, p.id)
      if (!target) fail('That truck does not exist.', 404)
      const block = truckDeleteBlock(state, target)
      if (block) fail(block, 409)
      return out({ id: target.id })
    }
    // Gives a truck its own route, or takes it away (routeId null).
    case 'truck/assignRoute': {
      const target = findTruck(state, p.id)
      if (!target) fail('That truck does not exist.', 404)
      const routeId = p.routeId === undefined || p.routeId === '' ? null : p.routeId
      if (routeId !== null && !routeById(state, routeId)) fail('That route does not exist.', 404)
      if (routeId === target.routeId) return out({ id: target.id, routeId })
      const owner = routeId && truckOfRoute(state, routeId)
      if (owner) fail(`${routeById(state, routeId).name} is already assigned to ${owner.id}. Remove it from ${owner.id} first.`, 409)
      if (runActiveOn(state, target.id)) fail(`${target.id} has a route in progress. End it before changing its route.`, 409)
      if (isMoving(simulationOf(state, target.id))) fail(`Stop ${target.id}'s simulated truck (Live Tracking) before changing its route.`, 409)
      return out({ id: target.id, routeId })
    }
    // Older Truck Management screen: the truck takes over the first route
    // (with its driver on duty and shift roster). Replaced by Assign Route.
    case 'truck/setService': {
      const target = findTruck(state, p.id)
      if (!target) fail('That truck does not exist.', 404)
      const from = truckById(state, primaryTruckId(state))
      if (target.id === from?.id) fail(`${target.id} is already the service truck.`, 409)
      if (target.routeId) fail(`${target.id} already has its own route.`, 409)
      if (runActiveOn(state, from?.id)) fail('A route is in progress. End it before changing the service truck.', 409)
      if (isMoving(simulationOf(state, from?.id)) || isMoving(simulationOf(state, target.id)))
        fail('Stop the simulated truck (Live Tracking) before changing the service truck.', 409)
      if (target.status !== 'active') fail(`${target.id} is ${truckStatusWord(target.status)}. Set it to Active first.`, 409)
      return out({ id: target.id })
    }
    // The driver on duty for one truck. They must be on that truck's shift roster.
    case 'truck/assignDriver': {
      const target = truckFor(p.truckId)
      const driverId = p.driverId ?? null
      const driver = driverId === null ? null : collectorsOf(state).find((c) => c.key === `driver:${driverId}`)
      if (driverId !== null && !driver) fail('That driver does not exist.')
      if (runActiveOn(state, target.id) && driverId !== target.driverId) fail('A route is in progress. End it before changing the driver.', 409)
      const elsewhere = driverId && truckOfDriver(state, driverId)
      if (elsewhere && elsewhere.id !== target.id && runActiveOn(state, elsewhere.id))
        fail(`${driver.name} is driving ${elsewhere.id} on a route in progress. End that route first.`, 409)
      if (driver && !holdsSlot(driver, target.id))
        fail(`${driver.name} is not an active ${target.id} driver. Put them on the Morning or Afternoon shift first (Collector's Management).`, 409)
      return out({ truckId: target.id, driverId })
    }
    case 'truck/logMaintenance': {
      const target = p.truckId === undefined ? truckById(state, primaryTruckId(state)) : findTruck(state, p.truckId)
      if (!target) fail('That truck does not exist.', 404)
      const km = int(p.odometerKm, 'Odometer', target.odometerKm ?? 0, 2_000_000)
      const date = str(p.date, 'Service date', { max: 10 })
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Service date is not valid.')
      const next = p.nextServiceDate ? String(p.nextServiceDate) : ''
      if (next && (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next <= date)) fail('Next service must be after the service date.')
      const newStatus = oneOf(p.newStatus, statusesForTruck(target), 'Status')
      if (isOutOfService(newStatus) && runActiveOn(state, target.id))
        fail(`End the current route before marking the truck ${outOfServiceWord(newStatus)}.`, 409)
      return out({
        truckId: target.id,
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
      const name = str(p.name, 'Driver name', { min: 3, max: 60 }).replace(/\s+/g, ' ')
      checkNotListed(state, name, null)
      const active = p.active === undefined ? true : bool(p.active, 'Status')
      const driver = {
        name,
        phone: phone(p.phone),
        license: str(p.license, 'License type', { max: 60 }),
        ...rosterPlace(state, { type: 'driver', key: null, current: null, shiftIn: p.shift, active, required: true, truckId: rosterTruckId(state, p.truckId, null) }),
        active,
        status: oneOf(p.status ?? 'standby', ['on-shift', 'standby', 'off-duty'], 'Availability'),
        ...(e ? { email: e } : {}),
        photo: profilePhoto(p.photo, null) ?? null,
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
      const key = `driver:${p.id}`
      if ('name' in patchIn) {
        patch.name = str(patchIn.name, 'Driver name', { min: 3, max: 60 }).replace(/\s+/g, ' ')
        if (!sameName(patch.name, target.name)) checkNotListed(state, patch.name, key)
      }
      if ('phone' in patchIn) patch.phone = phone(patchIn.phone)
      if ('license' in patchIn) patch.license = str(patchIn.license, 'License type', { max: 60 })
      // The truck the driver is driving right now (driver on duty), if any.
      const driving = truckOfDriver(state, p.id)
      if ('shift' in patchIn || 'active' in patchIn || 'truckId' in patchIn) {
        const current = collectorsOf(state).find((c) => c.key === key)
        const active = 'active' in patchIn ? bool(patchIn.active, 'Status') : current.active
        const truckId = rosterTruckId(state, patchIn.truckId, current)
        Object.assign(patch, rosterPlace(state, { type: 'driver', key, current, shiftIn: patchIn.shift, active, truckId }), { active })
        // The driver on duty leaves the truck: only when no route is running.
        if (driving && !holdsSlot(patch, driving.id) && runActiveOn(state, driving.id))
          fail('This driver has a route in progress. End the route first.', 409)
      }
      if ('photo' in patchIn) patch.photo = profilePhoto(patchIn.photo, target.photo ?? null)
      if ('email' in patchIn) {
        const e = email(patchIn.email, 'Driver email')
        patch.email = e
        effects.push({ type: 'updateDriverAccount', driverId: p.id, fields: { email: e || null } })
      }
      if ('status' in patchIn) {
        patch.status = oneOf(patchIn.status, ['on-shift', 'standby', 'off-duty'], 'Availability')
        if (patch.status === 'off-duty' && runActiveOn(state, driving?.id) && user.role === 'admin')
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
      if (runActiveOn(state, truckOfDriver(state, p.id)?.id)) fail('This driver has a route in progress. End the route first.', 409)
      effects.push({ type: 'disableDriverAccount', driverId: p.id })
      return out({ id: p.id })
    }

    // ---------- Routes & schedule ----------
    // Each truck has its own route. One purok, one truck: a purok's pickup
    // points may be on one route only (depots are not pickup points).
    case 'route/add': {
      const name = str(p.name, 'Route name', { min: 3, max: 80 })
      if (routesOf(state).some((r) => sameName(r.name, name))) fail(`There is already a route called ${name}.`, 409)
      const startTime = p.startTime ? str(p.startTime, 'Start time', { max: 8 }) : ''
      if (startTime && !time12.test(startTime)) fail('Start time is not valid.')
      // The depot (start and end of the route): the one sent, else the first route's depot.
      const depotIn = p.depot ?? routesOf(state)[0]?.stops[0]?.coords ?? barangay.center
      if (!Array.isArray(depotIn) || depotIn.length !== 2 || !depotIn.every(Number.isFinite) || Math.abs(depotIn[0]) > 90 || Math.abs(depotIn[1]) > 180)
        fail('The depot location is not valid.')
      return out({
        name,
        shortName: typeof p.shortName === 'string' ? p.shortName.trim().slice(0, 40) : '',
        startTime,
        depot: [Number(depotIn[0].toFixed(6)), Number(depotIn[1].toFixed(6))],
      })
    }
    case 'route/delete': {
      const route = routeById(state, p.id)
      if (!route) fail('That route does not exist.', 404)
      const owner = truckOfRoute(state, route.id)
      if (owner) fail(`${route.name} is assigned to ${owner.id}. Remove it from the truck first.`, 409)
      return out({ id: route.id })
    }
    case 'route/update': {
      // No routeId: the first truck's route (older screens send none).
      const route = routeById(state, p.routeId ?? routeOfTruck(state, primaryTruckId(state))?.id ?? routesOf(state)[0]?.id)
      if (!route) fail('That route does not exist.', 404)
      const start = str(p.startTime, 'Start time', { max: 8 })
      if (!time12.test(start)) fail('Start time is not valid.')
      return out({ routeId: route.id, name: str(p.name, 'Route name', { min: 3, max: 80 }), shortName: str(p.shortName, 'Short name', { max: 40 }), startTime: start })
    }
    case 'route/updateStop': {
      const route = routeOfStop(state, p.id)
      const stop = route?.stops.find((s) => s.id === p.id)
      if (!stop) fail('That stop does not exist.', 404)
      const patchIn = p.patch ?? {}
      const patch = { name: str(patchIn.name, 'Stop name', { min: 3, max: 80 }) }
      if (isCollectionStop(stop)) {
        patch.purok = oneOf(patchIn.purok, barangay.puroks, 'Purok')
        patch.households = int(patchIn.households, 'Households', 1, 500)
        checkPurokFree(state, patch.purok, route.id)
      }
      return out({ id: p.id, patch })
    }
    case 'route/addStop': {
      const coords = p.coords
      if (!Array.isArray(coords) || coords.length !== 2 || !coords.every(Number.isFinite)) fail('Pick the stop location on the map.')
      if (Math.abs(coords[0]) > 90 || Math.abs(coords[1]) > 180) fail('That location is not valid.')
      // The stop goes after another stop, which also says which route it is on.
      const route = routeOfStop(state, p.afterId)
      if (!route) fail('Choose where the stop goes in the route.')
      const purok = oneOf(p.purok, barangay.puroks, 'Purok')
      checkPurokFree(state, purok, route.id)
      return out({
        routeId: route.id,
        name: str(p.name, 'Stop name', { min: 3, max: 80 }),
        purok,
        households: int(p.households, 'Households', 1, 500),
        coords: [Number(coords[0].toFixed(6)), Number(coords[1].toFixed(6))],
        afterId: p.afterId,
      })
    }
    case 'route/removeStop':
    case 'route/moveStop':
      if (!routeOfStop(state, p.id)) fail('That stop does not exist.', 404)
      return out(action.type === 'route/moveStop' ? { id: p.id, dir: p.dir === -1 ? -1 : 1 } : { id: p.id })
    case 'schedule/update': {
      // Regular collection is only on the official days; only their time can change.
      if (!isCollectionDay(p.day)) fail(`Regular collection is only on ${scheduleLabel}.`)
      const window = str(p.patch?.window, 'Time window', { max: 25 })
      const [a, b] = window.split(' - ')
      if (!time12.test(a ?? '') || !time12.test(b ?? '')) fail('Time window is not valid.')
      return out({ day: p.day, patch: { wasteType: COLLECTION, window } })
    }

    // ---------- Collection runs (each truck has its own) ----------
    case 'run/start': {
      const truck = truckFor(p.truckId)
      if (user.role === 'driver' && !isCollectionDay(todayName()))
        fail(`No collection today. Regular routes run on ${scheduleLabel} only.`, 409)
      if (user.role === 'driver' && !isPickupDate(todayISO(), state.scheduleExceptions))
        fail(`No collection today: ${exceptionOn(todayISO(), state.scheduleExceptions).reason}.`, 409)
      if (isOutOfService(truck.status)) fail(`Truck ${truck.id} is ${outOfServiceWord(truck.status)}. The route cannot start.`, 409)
      const route = routeOfTruck(state, truck.id)
      if (!route) fail(`Truck ${truck.id} has no route. Assign a route first.`, 409)
      if (!route.stops.some(isCollectionStop)) fail('The route has no pickup points.', 409)
      return out(user.role === 'driver' ? { by: 'driver', driverId: user.refId, truckId: truck.id } : { by: 'admin', truckId: truck.id })
    }
    case 'run/end': {
      const truck = truckFor(p.truckId)
      // The driver ends the shift only after every stop is collected; the office may end a route any time.
      const run = state.runs.find((r) => r.id === activeRunIdOf(state, truck.id))
      if (user.role === 'driver' && run && !run.stops.every((s) => run.results[s.id]?.status === 'collected'))
        fail('Mark every stop as collected before ending your shift.', 409)
      return out({ truckId: truck.id })
    }
    case 'collection/mark': {
      // The office may record a stop of any truck (the stop says which).
      const truck = truckFor(p.truckId ?? (user.role === 'driver' ? undefined : truckOfStop(state, p.stopId)?.id))
      const stop = routeOfTruck(state, truck.id)?.stops.find((s) => s.id === p.stopId)
      if (!stop || !isCollectionStop(stop)) fail(`That pickup point is not on ${truck.id}'s route.`, 404)
      const status = oneOf(p.status, ['collected', 'missed'], 'Status')
      const note = typeof p.note === 'string' ? p.note.trim().slice(0, 300) : ''
      if (status === 'missed' && note.length < 3) fail('Give a reason when a stop is missed.')
      const driver = state.drivers.find((d) => d.id === user.refId)
      return out({
        truckId: truck.id,
        stopId: p.stopId,
        status,
        note,
        // Bag counts are no longer recorded: a stop record only says the stop was done.
        bags: null,
        by: user.role,
        byName: user.role === 'driver' ? driver?.name ?? 'Driver' : user.name ?? 'Barangay office',
      })
    }
    case 'collection/clear': {
      const truck = truckFor(p.truckId ?? (user.role === 'driver' ? undefined : truckOfStop(state, p.stopId)?.id))
      const rec = currentRun(state, truck.id)?.results[p.stopId]
      if (!rec) fail('There is no record to undo.', 404)
      if (user.role === 'driver' && rec.by !== 'driver') fail('Only the office can change records made by the office.', 403)
      return out({ truckId: truck.id, stopId: p.stopId })
    }
    case 'collection/clearAll':
      return out({ truckId: truckFor(p.truckId).id })
    case 'driver/reportIssue': {
      const truck = truckFor(p.truckId)
      // The stop is optional: a problem can happen on the road or at the depot.
      const stop = p.stopId ? routeOfTruck(state, truck.id)?.stops.find((s) => s.id === p.stopId) : null
      if (p.stopId && !stop) fail('That stop does not exist.', 404)
      const driver = state.drivers.find((d) => d.id === (user.role === 'driver' ? user.refId : truck.driverId))
      return out({
        truckId: truck.id,
        stopId: stop?.id ?? null,
        stopName: stop?.name ?? null,
        driverId: user.role === 'driver' ? user.refId : truck.driverId,
        issueType: str(p.issueType ?? 'other', 'Issue type', { max: 30 }),
        issueLabel: str(p.issueLabel, 'Issue type', { max: 60 }),
        description: str(p.description, 'Description', { min: 10, max: 250 }),
        photo: photo(p.photo),
        notifyDispatch: Boolean(p.notifyDispatch),
        markMissed: Boolean(p.markMissed && stop && isCollectionStop(stop)),
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
    case 'schedule/addException': {
      const date = String(p.date ?? '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00`))) fail('Choose a valid date.')
      if (!isCollectionDate(date)) fail(`Only ${scheduleLabel} have pickups, so only those dates can be suspended.`)
      if (date < todayISO()) fail('Choose today or a future date.')
      return out({ date, kind: oneOf(p.kind, Object.keys(exceptionKinds), 'Type'), reason: str(p.reason, 'Reason', { min: 3, max: 80 }) })
    }
    case 'schedule/removeException':
      if (!(state.scheduleExceptions ?? []).some((x) => x.date === p.date)) fail('That date is not on the list.', 404)
      return out({ date: p.date })

    case 'admin/setPhoto':
      return out({ photo: profilePhoto(p.photo ?? null, state.adminPhoto ?? null) })

    // ---------- Truck crew (admin) ----------
    case 'crew/add':
    case 'crew/update': {
      const editing = action.type === 'crew/update'
      const current = editing ? (state.crew ?? []).find((c) => c.id === p.id) : null
      if (editing && !current) fail('That crew member does not exist.', 404)
      const f = editing ? (p.patch ?? {}) : p
      const key = editing ? `crew:${p.id}` : null
      const name = str(f.name, 'Name', { min: 3, max: 60 }).replace(/\s+/g, ' ')
      if (!editing || !sameName(name, current.name)) checkNotListed(state, name, key)
      const status = oneOf(f.status ?? (editing ? current.status : 'active'), ['active', 'inactive'], 'Status')
      const was = editing ? collectorsOf(state).find((c) => c.key === key) : null
      const member = {
        name,
        // Position on the crew (Garbage Collector, Helper / Loader, ...).
        role: oneOf(f.role ?? (editing ? current.role : crewRoles[0]), crewRoles, 'Position'),
        phone: f.phone && String(f.phone).trim() ? phone(f.phone) : '',
        ...rosterPlace(state, { type: 'crew', key, current: was, shiftIn: f.shift, active: status === 'active', required: !editing, truckId: rosterTruckId(state, f.truckId, was) }),
        status,
        ...('photo' in f ? { photo: profilePhoto(f.photo, current?.photo ?? null) } : editing ? {} : { photo: null }),
      }
      return out(editing ? { id: p.id, patch: member } : member)
    }
    case 'crew/delete':
      if (!(state.crew ?? []).some((c) => c.id === p.id)) fail('That crew member does not exist.', 404)
      return out({ id: p.id })

    // ---------- Resident pickup feedback ----------
    // Answers are saved step by step. Each answer is stored as given: "I will
    // put it out" is never counted as "I put it out".
    case 'feedback/submit': {
      const resident = state.residents.find((r) => r.id === user.refId)
      if (!resident) fail('Your account was not found.', 404)
      // Answers are always for TODAY, and only on an official collection day.
      if (!isCollectionDay(todayName())) fail(`There is no garbage pickup today (pickup days: ${scheduleLabel}).`, 409)
      if (!isPickupDate(todayISO(), state.scheduleExceptions)) fail('There is no garbage pickup today (collection suspended).', 409)
      if (phHolidayOn(todayISO())) fail(`There is no garbage pickup today (${phHolidayOn(todayISO()).name}).`, 409)
      const yesNo = (v, label) => {
        if (v === null || v === undefined) return null
        if (typeof v !== 'boolean') fail(`${label} must be Yes or No.`)
        return v
      }
      const willDispose = yesNo(p.willDispose, 'Answer')
      if (willDispose === null) fail('Choose Yes or No.')
      let truckPassed = yesNo(p.truckPassed, 'Answer')
      let disposed = yesNo(p.disposed, 'Answer')
      if (!willDispose) truckPassed = disposed = null
      if (truckPassed === null) disposed = null
      let reason = null
      let reasonText = ''
      if (disposed === false) {
        const r = feedbackReasons.find((x) => x.id === p.reason)
        if (!r || (r.whenTruckPassed !== undefined && r.whenTruckPassed !== truckPassed)) fail('Choose why you could not put out your garbage.')
        reason = r.id
        reasonText = typeof p.reasonText === 'string' ? p.reasonText.trim().slice(0, 250) : ''
        if (r.id === 'other' && reasonText.length < 3) fail('Please tell us the reason in a few words.')
      }
      // The truck "did not pass" answer comes with the reason form, which means
      // the resident could not put the garbage out.
      if (truckPassed === false && disposed === true) fail('Answer is not valid.')
      const date = todayISO()
      // The run of the truck serving the resident's purok (one purok, one truck).
      const purokTruck = truckForPurok(state, resident.purok)
      const run = purokTruck
        ? (state.runs.find((r) => r.date === date && r.id === activeRunIdOf(state, purokTruck.id)) ?? state.runs.find((r) => r.date === date && r.truckId === purokTruck.id))
        : null
      const reasonDef = feedbackReasons.find((x) => x.id === reason)
      const category = reasonDef?.report ? reportCategories.find((c) => c.id === reasonDef.report) : null
      return out({
        residentId: resident.id,
        residentName: resident.name,
        purok: resident.purok,
        date,
        runId: run?.id ?? null,
        willDispose,
        truckPassed,
        disposed,
        reason,
        reasonText,
        report: category
          ? {
              residentId: resident.id,
              residentName: resident.name,
              residentPhone: resident.phone,
              category: category.id,
              categoryLabel: category.label,
              location: resident.address || resident.purok,
              description: `Pickup feedback (${date}): ${reasonDef.label}.${reasonText ? ` ${reasonText}` : ''}`.slice(0, 250),
              photo: null,
              smsUpdates: false,
            }
          : null,
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
      if ('photo' in patchIn) patch.photo = profilePhoto(patchIn.photo, state.residents.find((r) => r.id === user.refId)?.photo ?? null)
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
      if ('autoPickupCheck' in p) patch.autoPickupCheck = Boolean(p.autoPickupCheck)
      // Optional; empty means "not set" and the Driver app says so.
      if ('officePhone' in p) {
        const raw = typeof p.officePhone === 'string' ? p.officePhone.trim() : ''
        if (raw && !/^\+?[\d\s()-]{7,20}$/.test(raw)) fail('Office phone may only contain digits, spaces, ( ) - and +.')
        patch.officePhone = raw
      }
      return out(patch)
    }
    case 'sim/start':
    case 'sim/pause':
    case 'sim/resume':
    case 'sim/stop':
    case 'sim/reset': {
      // Each truck has its own simulated GPS; a driver controls only their own.
      const truck = truckFor(p.truckId)
      return out(action.type === 'sim/start' ? { truckId: truck.id, force: Boolean(p.force) } : { truckId: truck.id })
    }

    default:
      return fail('Unknown action.')
  }
}
