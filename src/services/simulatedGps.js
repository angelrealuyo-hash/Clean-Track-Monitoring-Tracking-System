// SIMULATED GPS — this prototype has no GPS hardware.
// The truck "drives" along the route stops on a timer so the maps have
// something to show. Every position is marked simulated: true, and screens
// should display SIMULATION_LABEL wherever a location is shown.

import { route } from '../data/routes.js'

export const SIMULATION_LABEL = 'Simulated GPS (demo data, not real truck location)'

// How many timer ticks it takes to drive between two stops.
const TICKS_PER_LEG = 10

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Position of the truck after `tick` timer ticks.
 * Loops back to the start after the last stop.
 */
export function getSimulatedPosition(tick, stops = route.stops) {
  const legs = stops.length - 1
  const step = tick % (legs * TICKS_PER_LEG)
  const legIndex = Math.floor(step / TICKS_PER_LEG)
  const t = (step % TICKS_PER_LEG) / TICKS_PER_LEG

  const from = stops[legIndex]
  const to = stops[legIndex + 1]

  return {
    simulated: true,
    lat: lerp(from.coords[0], to.coords[0], t),
    lng: lerp(from.coords[1], to.coords[1], t),
    // Fake but plausible speed for a garbage truck in a barangay (km/h).
    speedKmh: t === 0 ? 0 : 12 + ((tick * 7) % 10),
    lastStopIndex: legIndex,
    nextStopIndex: legIndex + 1,
    nextStop: to,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Starts the simulation. Calls onUpdate(position) every intervalMs.
 * Returns a function that stops it (call it when a component unmounts).
 */
export function startGpsSimulation(onUpdate, intervalMs = 2000) {
  let tick = 0
  onUpdate(getSimulatedPosition(tick))
  const timer = setInterval(() => {
    tick += 1
    onUpdate(getSimulatedPosition(tick))
  }, intervalMs)
  return () => clearInterval(timer)
}
