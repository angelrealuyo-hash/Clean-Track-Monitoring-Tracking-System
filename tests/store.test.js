// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dataReducer, currentRun } from '../src/store/dataReducer.js'
import { createInitialData } from '../src/store/initialData.js'
import { summarizeRun, notificationsForResident } from '../src/store/selectors.js'

const act = (s, type, payload) => dataReducer(s, { type, payload })

test('full collection workflow is stored as one run record', () => {
  let s = createInitialData()
  s = act(s, 'run/start', { by: 'driver', driverId: 'DRV-01' })
  const run = currentRun(s)
  assert.equal(run.status, 'in-progress')
  assert.equal(run.driverName, 'Carlos Ortiz')
  assert.equal(run.stops.length, 8)
  s = act(s, 'collection/mark', { stopId: 'STP-02', status: 'collected', by: 'driver', byName: 'Carlos Ortiz', bags: 12 })
  s = act(s, 'driver/reportIssue', { stopId: 'STP-08', stopName: 'Riverside', issueLabel: 'Road blocked', description: 'Van parked', notifyDispatch: true, markMissed: true, driverName: 'Carlos Ortiz' })
  assert.equal(currentRun(s).results['STP-02'].bags, 12)
  assert.equal(currentRun(s).results['STP-08'].status, 'missed')
  assert.ok(s.notifications[0].title.includes('Road blocked'), 'admin alerted')
  s = act(s, 'run/end')
  assert.equal(s.activeRunId, null)
  const ended = s.runs[0]
  assert.equal(ended.status, 'ended-early')
  assert.ok(ended.endedAt)
  assert.deepEqual(summarizeRun(ended), { total: 8, collected: 1, missed: 1, notDone: 6, percent: 13, households: 30 })
  assert.equal(currentRun(s).id, ended.id, "today's ended run is still shown")
})

test('starting twice on the same day keeps one open run', () => {
  let s = createInitialData()
  s = act(s, 'run/start', { by: 'driver' })
  const again = act(s, 'run/start', { by: 'driver' })
  assert.equal(again, s)
})

test('admin recording a stop without a started route creates a run', () => {
  let s = act(createInitialData(), 'collection/mark', { stopId: 'STP-04', status: 'collected', by: 'admin' })
  assert.equal(s.runs.length, 1)
  assert.equal(s.runs[0].startedBy, 'admin')
})

test('route builder: add, move and remove pickup points; depots protected', () => {
  let s = createInitialData()
  s = act(s, 'route/addStop', { name: 'New Corner', purok: 'Purok 3', households: 15, coords: [14.6, 120.99], afterId: 'STP-05' })
  const ids = s.route.stops.map((x) => x.id)
  assert.equal(ids[ids.indexOf('STP-05') + 1], 'STP-11')
  s = act(s, 'route/moveStop', { id: 'STP-11', dir: -1 })
  assert.equal(s.route.stops[ids.indexOf('STP-05')].id, 'STP-11')
  assert.equal(act(s, 'route/moveStop', { id: 'STP-01', dir: 1 }), s, 'start depot cannot move')
  assert.equal(act(s, 'route/moveStop', { id: 'STP-10', dir: -1 }), s, 'end depot cannot move')
  assert.equal(act(s, 'route/removeStop', { id: 'STP-01' }), s, 'depot cannot be removed')
  s = act(s, 'route/removeStop', { id: 'STP-11' })
  assert.ok(!s.route.stops.some((x) => x.id === 'STP-11'))
})

test('automatic notifications are added once per key and respect resident settings', () => {
  let s = createInitialData()
  const n = { key: 'near-2026-10-26-Purok 2', audience: 'resident', zone: 'Purok 2', kind: 'proximity', title: 'Truck coming' }
  s = act(s, 'notification/add', n)
  const once = act(s, 'notification/add', n)
  assert.equal(once, s)
  const maria = s.residents[0]
  assert.ok(notificationsForResident(s.notifications, maria).some((x) => x.key === n.key))
  const off = { ...maria, prefs: { ...maria.prefs, truckNearby: false } }
  assert.ok(!notificationsForResident(s.notifications, off).some((x) => x.key === n.key))
})

test('resident report -> admin resolves -> resident notified', () => {
  let s = createInitialData()
  s = act(s, 'report/add', { id: 'REP-T-1', residentId: 'RES-402', residentName: 'Maria', category: 'missed', categoryLabel: 'Missed collection', location: 'Purok 2', description: '' })
  assert.equal(s.reports[0].status, 'submitted')
  s = act(s, 'report/update', { id: 'REP-T-1', status: 'resolved', statusLabel: 'Resolved', adminResponse: 'Collected at 3 PM.' })
  assert.equal(s.reports[0].status, 'resolved')
  const note = notificationsForResident(s.notifications, s.residents[0]).find((x) => x.title.includes('REP-T-1'))
  assert.ok(note)
})
