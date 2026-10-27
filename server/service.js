// The CleanTrack service: keeps the shared data, applies actions through the
// same reducer the screens use (src/store/dataReducer.js), saves to SQLite,
// runs side effects (accounts, emails), and creates automatic notifications.
import { dataReducer, nextId, currentRun } from '../src/store/dataReducer.js'
import { createInitialData } from '../src/store/initialData.js'
import { viewFor } from '../src/store/view.js'
import { computeSimulation, isCollectionStop } from '../src/services/trackingSimulation.js'
import { plainWaste } from '../src/data/plainWords.js'
import { demoUsers } from '../src/data/users.js'
import { todayISO, todayName } from '../src/utils/format.js'
import { normalizePhone } from '../src/utils/validate.js'
import { transaction } from './db.js'
import { hasData, loadState, saveState, findAccount, getAccountByRef, insertAccount, updateAccount, logLocation } from './repository.js'
import { hashPassword } from './auth.js'
import { HttpError, prepareAction, SAFE_EMAIL } from './policy.js'
import { queueEmail, processQueue, emailConfig } from './email.js'

const LOGGED_ACTIONS = new Set(['sim/start', 'sim/pause', 'sim/resume', 'sim/stop', 'sim/reset', 'run/start', 'run/end', 'collection/mark'])

export function createService(db) {
  const listeners = new Set()
  let state

  // ---------- Startup: seed demo data only into an EMPTY database ----------
  if (!hasData(db)) seed()
  state = loadState(db)

  function seed() {
    transaction(db, () => {
      db.prepare("INSERT INTO meta (key, value) VALUES ('seeded_at', ?) ON CONFLICT(key) DO NOTHING").run(new Date().toISOString())
      seedAccounts()
    })
    saveState(db, createInitialData())
  }

  function seedAccounts() {
    const a = demoUsers
    insertAccount(db, { id: 'ACC-ADMIN', role: 'admin', refId: 'ADMIN', email: a.admin.email, passwordHash: hashPassword(a.admin.password) })
    insertAccount(db, { id: 'ACC-DRV-01', role: 'driver', refId: a.driver.id, email: a.driver.email, phone: '+63 917 555 0142', passwordHash: hashPassword(a.driver.password) })
    insertAccount(db, { id: `ACC-${a.resident.id}`, role: 'resident', refId: a.resident.id, email: a.resident.email, phone: a.resident.phone, passwordHash: hashPassword(a.resident.password) })
  }

  function commit(next) {
    saveState(db, next)
    state = { ...next, version: (next.version ?? 0) + 1 }
    for (const fn of listeners) fn(state.version)
  }

  const residentById = (id) => state.residents.find((r) => r.id === id)

  // ---------- Side effects that must be checked BEFORE saving ----------
  function precheck(effects) {
    for (const e of effects) {
      if (e.type === 'createDriverAccount' || e.type === 'setDriverPassword') {
        const clash = e.email && findAccount(db, 'driver', e.email)
        if (clash && clash.ref_id !== e.driverId) throw new HttpError(409, 'Another driver account already uses this email.')
      }
      if (e.type === 'updateResidentAccount') {
        for (const v of [e.fields.phone, e.fields.email].filter(Boolean)) {
          const clash = findAccount(db, 'resident', v)
          if (clash && clash.ref_id !== e.residentId) throw new HttpError(409, 'Another account already uses this phone number or email.')
        }
      }
      if (e.type === 'updateDriverAccount' && e.fields.email) {
        const clash = findAccount(db, 'driver', e.fields.email)
        if (clash && clash.ref_id !== e.driverId) throw new HttpError(409, 'Another driver account already uses this email.')
      }
    }
  }

  function runEffects(effects, before, after) {
    for (const e of effects) {
      switch (e.type) {
        case 'createDriverAccount': {
          const created = after.drivers.find((d) => !before.drivers.some((b) => b.id === d.id))
          if (created) insertAccount(db, { id: `ACC-${created.id}`, role: 'driver', refId: created.id, email: e.email, phone: e.phone, passwordHash: hashPassword(e.password) })
          break
        }
        case 'setDriverPassword': {
          if (getAccountByRef(db, 'driver', e.driverId)) updateAccount(db, 'driver', e.driverId, { password_hash: hashPassword(e.password), active: 1 })
          else insertAccount(db, { id: `ACC-${e.driverId}`, role: 'driver', refId: e.driverId, email: e.email, phone: e.phone, passwordHash: hashPassword(e.password) })
          break
        }
        case 'updateDriverAccount':
          updateAccount(db, 'driver', e.driverId, e.fields)
          break
        case 'disableDriverAccount':
          updateAccount(db, 'driver', e.driverId, { active: 0 })
          break
        case 'updateResidentAccount':
          updateAccount(db, 'resident', e.residentId, e.fields)
          break
        case 'emailReportUpdate': {
          const report = after.reports.find((r) => r.id === e.reportId)
          const resident = report && residentById(report.residentId)
          if (resident?.email && resident.prefs?.email) {
            const status = { submitted: 'Submitted', 'in-progress': 'Reviewing', resolved: 'Resolved' }[report.status]
            queueEmail(db, {
              eventKey: `report:${report.id}:${report.status}:${report.history.length}`,
              to: resident.email,
              subject: `CleanTrack: your report ${report.id} is ${status}`,
              body: `Hello ${resident.name},\n\nYour report ${report.id} is now: ${status}.\n${report.adminResponse ? `\nBarangay reply: ${report.adminResponse}\n` : ''}\nOpen the CleanTrack Resident app for details.\n\n— ${after.settings.barangayName || 'CleanTrack'}`,
              relatedType: 'report',
              relatedId: report.id,
            })
          }
          break
        }
        case 'emailBroadcast': {
          const b = after.broadcasts[0]
          for (const r of after.residents) {
            if (!r.email || !r.prefs?.email) continue
            if (b.zone !== 'All Puroks' && r.purok !== b.zone) continue
            queueEmail(db, {
              eventKey: `broadcast:${b.id}:${r.id}`,
              to: r.email,
              subject: `CleanTrack: ${b.subject}`,
              body: `${b.message}\n\n— ${after.settings.barangayName || 'CleanTrack'}`,
              relatedType: 'broadcast',
              relatedId: b.id,
            })
          }
          break
        }
      }
    }
  }

  function logTruck(next, event) {
    const sim = computeSimulation({ route: next.route, control: next.simulation, results: currentRun(next)?.results ?? {}, tickMs: next.settings.simulationIntervalMs })
    if (sim.position) logLocation(db, { lat: sim.position.lat, lng: sim.position.lng, status: sim.status, runId: next.activeRunId, event })
  }

  /** Applies an action for a signed-in user. Returns the user's new data snapshot. */
  function perform(user, rawAction) {
    const { action, effects } = prepareAction(state, user, rawAction)
    precheck(effects)
    const before = state
    const next = dataReducer(state, action)
    if (next !== state) {
      transaction(db, () => runEffects(effects, before, next))
      commit(next)
      if (LOGGED_ACTIONS.has(action.type)) logTruck(state, action.type)
      kickEmail()
    }
    return snapshotFor(user)
  }

  // ---------- Residents sign up ----------
  function register({ name, phone, email = '', street, purok, password }) {
    const cleanName = String(name ?? '').trim().replace(/\s+/g, ' ')
    if (cleanName.split(' ').length < 2 || cleanName.length > 60) throw new HttpError(400, 'Enter your first and last name.')
    const p = normalizePhone(String(phone ?? ''))
    if (!p) throw new HttpError(400, 'Enter a PH mobile number, e.g. 0917 555 0192.')
    const e = String(email ?? '').trim().toLowerCase()
    if (e && !SAFE_EMAIL.test(e)) throw new HttpError(400, 'Check the email, or leave it empty.')
    const s = String(street ?? '').trim()
    if (s.length < 3 || s.length > 100) throw new HttpError(400, 'Enter your house number and street.')
    if (!state.route || !(purok && /^Purok \d+$/.test(purok))) throw new HttpError(400, 'Choose your purok.')
    if (String(password ?? '').length < 6) throw new HttpError(400, 'Use at least 6 characters for the password.')
    if (findAccount(db, 'resident', p)) throw new HttpError(409, 'This number already has an account. Sign in instead.')
    if (e && findAccount(db, 'resident', e)) throw new HttpError(409, 'An account with this email already exists. Sign in instead.')

    const id = nextId('RES', state.residents, 3)
    const next = dataReducer(state, { type: 'resident/add', payload: { id, name: cleanName, email: e, phone: p, address: `${s}, ${purok}`, purok } })
    transaction(db, () => insertAccount(db, { id: `ACC-${id}`, role: 'resident', refId: id, email: e, phone: p, passwordHash: hashPassword(password) }))
    commit(next)
    return { role: 'resident', refId: id, name: cleanName }
  }

  // Driver sign-in status always comes from the accounts table.
  function withDriverAccounts(s) {
    const rows = db.prepare("SELECT ref_id, active FROM accounts WHERE role = 'driver'").all()
    const byId = Object.fromEntries(rows.map((r) => [r.ref_id, r.active ? 'active' : 'disabled']))
    return { ...s, drivers: s.drivers.map((d) => ({ ...d, account: byId[d.id] ?? 'none' })) }
  }

  function snapshotFor(user) {
    const data = viewFor(user.role === 'admin' ? withDriverAccounts(state) : state, user)
    return { data, version: state.version, email: emailConfig() }
  }

  // ---------- Automatic notifications (in-app + email) ----------
  let lastNearKey = ''
  let lastStopKey = ''

  function addAuto(payload) {
    const next = dataReducer(state, { type: 'notification/add', payload })
    if (next !== state) commit(next)
    return next !== state
  }

  function emailResidents(filter, makeEmail) {
    for (const r of state.residents) {
      if (!r.email || !r.prefs?.email || !filter(r)) continue
      queueEmail(db, makeEmail(r))
    }
  }

  // Rule for "truck approaching" (explicit and simulation-based): when the
  // SIMULATED truck starts driving to the FIRST pickup point of a purok, that
  // purok gets one message per route run. It is never claimed to be real GPS.
  function tick(nowMs = Date.now()) {
    if (!state?.route) return
    const s = state.settings

    // Pickup-day reminder, once per day.
    const today = todayISO()
    const run = state.weeklySchedule.find((d) => d.day === todayName())
    if (s.autoScheduleReminders && run && run.wasteType !== 'No collection') {
      const start = run.window.split(' - ')[0]
      const added = addAuto({
        key: `schedule-${today}`,
        audience: 'resident',
        zone: 'All Puroks',
        kind: 'schedule',
        priority: 'medium',
        title: `Pickup today: ${plainWaste(run.wasteType)}`,
        body: `Please put your tied garbage bags out before ${start}.`,
        link: { label: 'See pickup days', to: '/resident/schedule' },
      })
      if (added)
        emailResidents(
          (r) => r.prefs?.scheduleReminders,
          (r) => ({
            eventKey: `schedule:${today}:${r.id}`,
            to: r.email,
            subject: `CleanTrack: pickup today (${plainWaste(run.wasteType)})`,
            body: `Hello ${r.name},\n\nToday's pickup is ${plainWaste(run.wasteType)}, ${run.window}. Please put your tied garbage bags out before ${start}.\n\n— ${s.barangayName || 'CleanTrack'}`,
            relatedType: 'schedule',
            relatedId: today,
          }),
        )
    }

    // Truck approaching a purok (simulated).
    const results = currentRun(state)?.results ?? {}
    const sim = computeSimulation({ route: state.route, control: state.simulation, results, nowMs, tickMs: s.simulationIntervalMs })
    const stops = state.route.stops
    const targetIndex = sim.waitingAt ? stops.findIndex((x) => x.id === sim.waitingAt) : sim.status === 'running' || sim.status === 'paused' ? sim.legIndex + 1 : -1
    const target = targetIndex > 0 ? stops[targetIndex] : null
    const prev = target ? stops.slice(0, targetIndex).filter(isCollectionStop).at(-1) : null
    const purok = target && isCollectionStop(target) && prev?.purok !== target.purok ? target.purok : null
    if (s.autoProximityAlerts && purok && sim.startedAt) {
      const key = `near-${sim.startedAt}-${purok}`
      if (key !== lastNearKey) {
        lastNearKey = key
        const added = addAuto({
          key,
          audience: 'resident',
          zone: purok,
          kind: 'proximity',
          priority: 'high',
          title: 'The garbage truck is coming',
          body: `The truck is on its way to ${purok}. Please put your garbage bags out now. (Demo: simulated truck location.)`,
          link: { label: 'See the truck', to: '/resident/track' },
        })
        if (added)
          emailResidents(
            (r) => r.purok === purok && r.prefs?.truckNearby,
            (r) => ({
              eventKey: `near:${sim.startedAt}:${purok}:${r.id}`,
              to: r.email,
              subject: 'CleanTrack: the garbage truck is coming',
              body: `Hello ${r.name},\n\nThe garbage truck is heading to ${purok}. Please put your garbage bags out now.\n\nNote: this demo uses a SIMULATED truck location, not real GPS.\n\n— ${s.barangayName || 'CleanTrack'}`,
              relatedType: 'proximity',
              relatedId: purok,
            }),
          )
      }
    }

    // Log the simulated position when the truck reaches a stop (low frequency).
    if (sim.waitingAt) {
      const key = `${sim.startedAt}-${sim.waitingAt}`
      if (key !== lastStopKey) {
        lastStopKey = key
        logLocation(db, { lat: sim.position.lat, lng: sim.position.lng, status: 'waiting', runId: state.activeRunId, event: `arrived:${sim.waitingAt}` })
      }
    }
    kickEmail()
  }

  let sending = false
  function kickEmail() {
    if (sending || !emailConfig().configured) return
    sending = true
    processQueue(db)
      .catch(() => {})
      .finally(() => {
        sending = false
      })
  }

  // ---------- Demo reset (admin, explicit confirmation in the UI) ----------
  function resetDemo() {
    transaction(db, () => {
      db.exec('DELETE FROM accounts')
      seedAccounts()
    })
    const fresh = createInitialData()
    commit({ ...fresh, version: state.version })
  }

  return {
    get state() {
      return state
    },
    perform,
    register,
    snapshotFor,
    tick,
    resetDemo,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
  }
}
