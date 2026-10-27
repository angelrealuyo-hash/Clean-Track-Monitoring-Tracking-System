// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeSimulation, getRouteProgress, simElapsed, validateRoute, LOCATION_SOURCE } from '../src/services/trackingSimulation.js'
import { dataReducer } from '../src/store/dataReducer.js'
import { createInitialData } from '../src/store/initialData.js'
import { route } from '../src/data/routes.js'

const T0 = Date.parse('2026-10-26T06:00:00Z')
const LEG = 6000 // tickMs 1000 x 6 steps
const running = { status: 'running', startedAt: new Date(T0).toISOString(), pausedAt: null, stoppedAt: null, pausedMs: 0 }
const at = (ms, control = running, results = {}) => computeSimulation({ route, control, results, nowMs: T0 + ms })

test('idle: truck parked at the depot, labelled SIMULATED', () => {
  const s = computeSimulation({ route })
  assert.equal(s.status, 'idle')
  assert.deepEqual(s.position, { lat: route.stops[0].coords[0], lng: route.stops[0].coords[1] })
  assert.equal(s.source, LOCATION_SOURCE)
  assert.equal(LOCATION_SOURCE, 'SIMULATED')
})

test('repeatable: same inputs always give the same position (no random jumps)', () => {
  assert.deepEqual(at(2500).position, at(2500).position)
  const a = at(3000).position
  const half = route.stops.slice(0, 2).map((s) => s.coords)
  assert.ok(Math.abs(a.lat - (half[0][0] + half[1][0]) / 2) < 1e-9, 'halfway along the first leg at half the leg time')
})

test('truck waits at a pickup point until it is recorded', () => {
  const first = route.stops[1]
  const w = at(LEG + 500)
  assert.equal(w.waitingAt, first.id)
  assert.deepEqual(at(LEG * 5).position, w.position, 'still waiting much later')
  // Recorded at sim time 20s: the truck leaves then, and is driving 2s later.
  const results = { [first.id]: { status: 'collected', simAt: 20000 } }
  assert.equal(at(19000, running, results).waitingAt, null)
  assert.deepEqual(at(19000, running, results).position, w.position, 'still at the stop before 20s')
  const moving = at(22000, running, results)
  assert.equal(moving.legIndex, 1)
  assert.notDeepEqual(moving.position, w.position)
})

test('stop recorded before the truck arrives: no waiting there', () => {
  const results = { 'STP-02': { status: 'collected', simAt: 0 } }
  const s = at(LEG + 3000, running, results)
  assert.equal(s.legIndex, 1, 'already driving to the second pickup point')
})

test('pause freezes the truck, resume continues from the same place', () => {
  const paused = { ...running, status: 'paused', pausedAt: new Date(T0 + 3000).toISOString() }
  assert.deepEqual(at(3000).position, computeSimulation({ route, control: paused, nowMs: T0 + 60000 }).position)
  const resumed = { ...running, pausedMs: 57000 } // resumed at 60s after a 57s pause
  assert.deepEqual(computeSimulation({ route, control: resumed, nowMs: T0 + 60000 }).position, at(3000).position)
  assert.equal(simElapsed(resumed, T0 + 61000), 4000)
})

test('stop freezes the truck where it was', () => {
  const stopped = { ...running, status: 'stopped', stoppedAt: new Date(T0 + 2000).toISOString() }
  const s = computeSimulation({ route, control: stopped, nowMs: T0 + 99999 })
  assert.equal(s.status, 'stopped')
  assert.deepEqual(s.position, at(2000).position)
})

test('reaches the end only after every pickup point is recorded', () => {
  const results = Object.fromEntries(route.stops.slice(1, -1).map((s) => [s.id, { status: 'collected', simAt: 0 }]))
  assert.equal(at(LEG * route.stops.length, running, results).status, 'completed')
  assert.notEqual(at(LEG * route.stops.length).status, 'completed')
})

test('progress: collected/missed come only from records, never from the truck passing', () => {
  const allDone = Object.fromEntries(route.stops.slice(1, -1).map((s) => [s.id, { status: 'collected', simAt: 0 }]))
  const end = at(LEG * 20, running, allDone)
  assert.equal(getRouteProgress(route, end, {}).collected, 0, 'position alone never counts as collected')
  const p = getRouteProgress(route, end, { 'STP-02': { status: 'collected' }, 'STP-03': { status: 'missed' } })
  assert.equal(p.collected, 1)
  assert.equal(p.missed, 1)
})

test('store controls: start / pause / resume / stop, and records get the truck clock', () => {
  let s = createInitialData()
  const act = (type, payload) => (s = dataReducer(s, { type, payload }))
  act('sim/start')
  assert.equal(s.simulation.status, 'running')
  const startedAt = s.simulation.startedAt
  act('sim/start')
  assert.equal(s.simulation.startedAt, startedAt, 'start while running is ignored')
  act('sim/pause')
  assert.equal(s.simulation.status, 'paused')
  act('sim/resume')
  assert.equal(s.simulation.status, 'running')
  act('collection/mark', { stopId: 'STP-02', status: 'collected', by: 'driver' })
  assert.ok(Number.isFinite(s.runs[0].results['STP-02'].simAt))
  act('sim/stop')
  assert.equal(s.simulation.status, 'stopped')
  act('sim/start', { force: true })
  assert.equal(s.simulation.status, 'running')
  act('route/moveStop', { id: 'STP-03', dir: 1 })
  assert.equal(s.simulation.status, 'idle', 'changing the route resets the demo truck')
})

test('invalid routes are rejected', () => {
  assert.ok(validateRoute({ stops: [] }))
  assert.equal(validateRoute(route), null)
})
