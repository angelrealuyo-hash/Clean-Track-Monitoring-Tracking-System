// Truck 1 personnel rules, shared by the screens and the server (server/policy.js).
//
// Each shift on the truck has 1 Driver and 3 Crew Members, so the truck has at
// most 2 Drivers + 6 Crew Members = 8 people.
//
// Capacity rule: only ACTIVE people assigned to the truck and a shift take a
// slot. Marking someone Inactive frees their slot (they keep their shift so it
// is shown, but they need a free slot again to become Active).

export const SHIFTS = {
  morning: { label: 'Morning Shift', short: 'Morning', hours: '06:00 AM - 02:00 PM' },
  afternoon: { label: 'Afternoon Shift', short: 'Afternoon', hours: '02:00 PM - 10:00 PM' },
}
export const SHIFT_KEYS = Object.keys(SHIFTS)

// Driver = blue, Crew Member = green (always shown with the role name).
export const ROLES = {
  driver: { label: 'Driver', plural: 'Drivers', tone: 'blue' },
  crew: { label: 'Crew Member', plural: 'Crew Members', tone: 'green' },
}
export const ROLE_KEYS = Object.keys(ROLES)

// Per shift.
export const LIMITS = { driver: 1, crew: 3 }
export const SHIFT_LIMIT = LIMITS.driver + LIMITS.crew
export const TOTAL_LIMITS = { driver: LIMITS.driver * SHIFT_KEYS.length, crew: LIMITS.crew * SHIFT_KEYS.length }
export const TOTAL_LIMIT = SHIFT_LIMIT * SHIFT_KEYS.length

export const shiftLabel = (shift) => SHIFTS[shift]?.label ?? 'No shift'
export const shiftWithHours = (shift) => (SHIFTS[shift] ? `${SHIFTS[shift].label} (${SHIFTS[shift].hours})` : 'Not on a shift')

/** Drivers and crew as one list: { key, type, id, name, shift, truckId, active, rec }. */
export function collectorsOf(state) {
  return [
    ...(state.drivers ?? []).map((d) => ({ key: `driver:${d.id}`, type: 'driver', id: d.id, name: d.name, shift: d.shift ?? null, truckId: d.truckId ?? null, active: d.active !== false, rec: d })),
    ...(state.crew ?? []).map((c) => ({ key: `crew:${c.id}`, type: 'crew', id: c.id, name: c.name, shift: c.shift ?? null, truckId: c.truckId ?? null, active: c.status === 'active', rec: c })),
  ]
}

/** True when this person holds a slot on the truck. */
export const holdsSlot = (p, truckId) => p.active && p.truckId === truckId && SHIFTS[p.shift] !== undefined

/**
 * Slot counts for the truck. `excludeKey` ("driver:DRV-01" / "crew:CRW-01")
 * leaves one person out, so an edit is checked as if they had left.
 */
export function capacityOf(state, { excludeKey = null } = {}) {
  const truckId = state.truck?.id
  const counts = Object.fromEntries(SHIFT_KEYS.map((s) => [s, { driver: 0, crew: 0 }]))
  for (const p of collectorsOf(state)) if (p.key !== excludeKey && holdsSlot(p, truckId)) counts[p.shift][p.type] += 1
  const total = (type) => SHIFT_KEYS.reduce((n, s) => n + counts[s][type], 0)
  return {
    shifts: counts,
    shiftTotal: (s) => counts[s].driver + counts[s].crew,
    drivers: total('driver'),
    crew: total('crew'),
    overall: total('driver') + total('crew'),
  }
}

/** Is there a free slot for this role on this shift? */
export function hasRoom(state, type, shift, { excludeKey = null } = {}) {
  if (!SHIFTS[shift] || !LIMITS[type]) return false
  return capacityOf(state, { excludeKey }).shifts[shift][type] < LIMITS[type]
}

/** Plain message for a full slot, with the count, e.g. "Morning Shift Drivers: 1/1". */
export function fullMessage(type, shift) {
  const what = type === 'driver' ? 'Drivers' : 'Crew'
  return `The ${shiftLabel(shift)} already has ${LIMITS[type]} ${LIMITS[type] === 1 ? ROLES[type].label : ROLES[type].plural} (${shiftLabel(shift)} ${what}: ${LIMITS[type]}/${LIMITS[type]}).`
}

/** Name used to spot the same person added twice. */
export const sameName = (a, b) => String(a ?? '').trim().replace(/\s+/g, ' ').toLowerCase() === String(b ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
