// The barangay's garbage trucks. Each truck can have its own route, driver on
// duty, shift crew and demo GPS (see src/store/fleet.js). This first truck is
// the demo data; more are added in Truck Management.
export const truck = {
  id: 'TRK-01',
  plateNumber: 'ABC-1024',
  type: 'Mini Compactor',
  model: '2022 Isuzu Elf N-Series',
  capacityTons: 5.0,
  fuel: 'Diesel Euro-4',
  odometerKm: 24380,
  driverId: 'DRV-01',
  routeId: 'RT-01',
  // see SERVICE_STATUSES below
  status: 'active',
  maintenance: [
    {
      date: '2024-05-18',
      type: 'Routine Inspection & Oil Change',
      notes: 'Cleared municipal safety inspection.',
    },
  ],
  nextServiceDate: '2024-06-25',
}

export const maintenanceTypes = [
  'Routine Inspection & Oil Change',
  'Hydraulic System Repair',
  'Brake Pad Replacement',
  'Tire Replacement / Alignment',
  'Emergency Breakdown Service',
]

export const vehicleTypes = ['Mini Compactor', 'Dump Truck', 'Utility Flatbed']
export const fuelTypes = ['Diesel Euro-4', 'Diesel Euro-2', 'Gasoline', 'Electric']

// ---------- Fleet ----------
// No fixed number of trucks (the barangay reference has about six); this is
// only a safety limit against runaway entries.
export const MAX_TRUCKS = 50

// A truck with a route may also be Delayed or on Standby while it runs it.
// A truck without a route is only Active (ready), Inactive or Under maintenance.
export const RESERVE_STATUSES = ['active', 'inactive', 'maintenance']
export const SERVICE_STATUSES = ['active', 'delayed', 'standby', 'inactive', 'maintenance']
export const statusesForTruck = (t) => (t?.routeId ? SERVICE_STATUSES : RESERVE_STATUSES)

// A truck in these states cannot run its route.
export const isOutOfService = (status) => status === 'maintenance' || status === 'inactive'

/** Every registered truck. (Older data without `trucks`: the truck and reserve trucks.) */
export const allTrucks = (state) => state.trucks ?? [state.truck, ...(state.reserveTrucks ?? [])].filter(Boolean)
export const findTruck = (state, id) => allTrucks(state).find((t) => t.id === id) ?? null
/** Does this truck have a route? */
export const isServiceTruck = (state, id) => Boolean(findTruck(state, id)?.routeId)

// "abc 1024" and "ABC-1024" are the same plate.
export const plateKey = (plate) => String(plate ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const truckIdKey = (id) => String(id ?? '').trim().toUpperCase()

// Trucks store "Year & Model" as one text ("2022 Isuzu Elf N-Series"), so the
// existing data and database column stay as they are. The forms edit the
// year and the model separately.
export const MIN_TRUCK_YEAR = 1980
export const maxTruckYear = () => new Date().getFullYear() + 1
export function splitModel(model) {
  const m = /^(\d{4})\s+(.*)$/.exec(String(model ?? '').trim())
  return m ? { year: m[1], model: m[2] } : { year: '', model: String(model ?? '').trim() }
}
export const joinModel = (year, model) => [String(year ?? '').trim(), String(model ?? '').trim()].filter(Boolean).join(' ')

/** Suggested ID for a new truck: TRK-02, TRK-03, ... */
export function nextTruckId(trucks) {
  const nums = trucks.map((t) => /^TRK-(\d+)$/i.exec(t.id)?.[1]).filter(Boolean).map(Number)
  return `TRK-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`
}

// Why a truck may not be deleted (null = it may). The server refuses with the
// same reason; Truck Management shows it on the disabled Delete button.
export function truckDeleteBlock(state, t) {
  if (t.routeId) return `${t.id} is the service truck on a route. Assign the route to another truck first.`
  if (state.sessions?.[t.id]?.activeRunId) return `${t.id} has a route in progress. End it first.`
  const people = [...(state.drivers ?? []), ...(state.crew ?? [])].filter((x) => x.truckId === t.id).length
  if (people) return `${t.id} still has ${people} collector(s) assigned. Move them first.`
  const runs = (state.runs ?? []).filter((r) => r.truckId === t.id).length
  if (runs) return `${t.id} has ${runs} saved collection run(s). Set it to Inactive instead so the history stays complete.`
  return null
}
