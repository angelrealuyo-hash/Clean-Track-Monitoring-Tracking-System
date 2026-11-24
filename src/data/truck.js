// The barangay's service truck: the one that runs the collection route, shows on
// Live Tracking and is driven by the shift drivers. More trucks can be added in
// Truck Management; they are kept as reserve trucks (see `reserveTrucks` in the
// store) until the admin makes one the service truck.
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

// ---------- Fleet (service truck + reserve trucks) ----------
// The service truck may also be Delayed or on Standby while it runs the route.
// Reserve trucks are only Active (ready), Inactive or Under maintenance.
export const RESERVE_STATUSES = ['active', 'inactive', 'maintenance']
export const SERVICE_STATUSES = ['active', 'delayed', 'standby', 'inactive', 'maintenance']

// A truck in these states cannot run the route.
export const isOutOfService = (status) => status === 'maintenance' || status === 'inactive'

/** Every registered truck, service truck first. */
export const allTrucks = (state) => [state.truck, ...(state.reserveTrucks ?? [])].filter(Boolean)
export const findTruck = (state, id) => allTrucks(state).find((t) => t.id === id) ?? null
export const isServiceTruck = (state, id) => state.truck?.id === id

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
  if (t.id === state.truck?.id) return `${t.id} is the service truck on the route. Make another truck the service truck first.`
  const people = [...(state.drivers ?? []), ...(state.crew ?? [])].filter((x) => x.truckId === t.id).length
  if (people) return `${t.id} still has ${people} collector(s) assigned. Move them first.`
  const runs = (state.runs ?? []).filter((r) => r.truckId === t.id).length
  if (runs) return `${t.id} has ${runs} saved collection run(s). Set it to Inactive instead so the history stays complete.`
  return null
}
