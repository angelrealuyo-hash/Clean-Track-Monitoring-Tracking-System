// CleanTrack REST API (Express). Mounted at /api by the Vite dev server and by
// server/index.js in production.
//
//   POST /api/auth/login       { role, identifier, password }      -> { token, user }
//   POST /api/auth/register    resident sign-up                     -> { token, user }
//   GET  /api/state            this user's data snapshot (role-filtered)
//   POST /api/actions          { type, payload }                    -> new snapshot
//   GET  /api/events?token=    live "data changed" stream (Server-Sent Events)
//   GET  /api/admin/email-log  email attempts (admin)
//   GET  /api/admin/locations  simulated location history (admin)
//   POST /api/admin/reset      restore demo data (admin)
import express from 'express'
import { openDatabase } from './db.js'
import { createService } from './service.js'
import { getSecret, hashPassword, signToken, verifyPassword, verifyToken } from './auth.js'
import { findAccount, getAccountByRef, recentLocations, updateAccount } from './repository.js'
import { emailLog, emailConfig } from './email.js'
import { HttpError } from './policy.js'
import { canViewImage, getImage } from './uploads.js'
import { demoUsers } from '../src/data/users.js'
import { normalizePhone } from '../src/utils/validate.js'

export function createApi({ db = openDatabase(), tickMs = 15_000 } = {}) {
  const service = createService(db)
  const secret = getSecret(db)
  const api = express.Router()
  api.use(express.json({ limit: '1mb' }))

  // Background job: automatic notifications + email queue. Cleared by close().
  const timer = tickMs ? setInterval(() => safeTick(), tickMs) : null
  function safeTick() {
    try {
      service.tick()
    } catch (err) {
      console.error('CleanTrack tick failed:', err)
    }
  }

  const userFromToken = (token) => {
    const payload = verifyToken(secret, token)
    if (!payload) return null
    // The account must still exist and be active (e.g. a disabled driver).
    const account = getAccountByRef(db, payload.role, payload.refId)
    if (!account || !account.active) return null
    return { role: payload.role, refId: payload.refId, name: payload.name }
  }

  const requireUser = (roles) => (req, res, next) => {
    const header = req.get('authorization') ?? ''
    const user = userFromToken(header.startsWith('Bearer ') ? header.slice(7) : '')
    if (!user) return res.status(401).json({ error: 'Please sign in again.' })
    if (roles && !roles.includes(user.role)) return res.status(403).json({ error: 'You are not allowed to do that.' })
    req.user = user
    next()
  }

  const nameFor = (role, refId) => {
    if (role === 'admin') return demoUsers.admin.name
    const list = role === 'driver' ? service.state.drivers : service.state.residents
    return list.find((x) => x.id === refId)?.name ?? ''
  }

  const issue = (role, refId) => {
    const user = { role, refId, name: nameFor(role, refId) }
    return { token: signToken(secret, user), user: { ...user, ...(role === 'admin' ? { title: demoUsers.admin.title, initials: demoUsers.admin.initials } : {}) } }
  }

  // ---------- Auth ----------
  api.post('/auth/login', (req, res) => {
    const { role, identifier, password } = req.body ?? {}
    if (!['admin', 'driver', 'resident'].includes(role) || typeof identifier !== 'string' || typeof password !== 'string')
      return res.status(400).json({ error: 'Enter your sign-in details.' })
    const id = identifier.trim()
    // Residents may also sign in with their mobile number in any common format.
    const phone = role === 'resident' ? normalizePhone(id) : null
    const account = findAccount(db, role, id.toLowerCase()) ?? (phone ? findAccount(db, role, phone) : null)
    if (!account || !verifyPassword(password, account.password_hash)) return res.status(401).json({ error: 'Wrong email or password.' })
    if (!account.active) return res.status(403).json({ error: 'This account is disabled. Please contact the barangay office.' })
    res.json(issue(role, account.ref_id))
  })

  api.post('/auth/register', (req, res, next) => {
    try {
      const user = service.register(req.body ?? {})
      res.status(201).json(issue('resident', user.refId))
    } catch (err) {
      next(err)
    }
  })

  api.get('/me', requireUser(), (req, res) => res.json({ user: req.user }))

  // Change your own password (any role). Requires the current password.
  api.post('/auth/password', requireUser(), (req, res) => {
    const { current, next } = req.body ?? {}
    const account = getAccountByRef(db, req.user.role, req.user.refId)
    if (!account || typeof current !== 'string' || !verifyPassword(current, account.password_hash))
      return res.status(400).json({ error: 'Your current password is not correct.' })
    if (typeof next !== 'string' || next.length < 6) return res.status(400).json({ error: 'Use at least 6 characters for the new password.' })
    updateAccount(db, req.user.role, req.user.refId, { password_hash: hashPassword(next) })
    res.json({ ok: true })
  })

  // ---------- Data ----------
  api.get('/state', requireUser(), (req, res) => res.json(service.snapshotFor(req.user)))

  api.post('/actions', requireUser(), (req, res, next) => {
    try {
      res.json(service.perform(req.user, req.body))
    } catch (err) {
      next(err)
    }
  })

  // Live updates: tells open screens to reload their snapshot.
  api.get('/events', (req, res) => {
    const user = userFromToken(String(req.query.token ?? ''))
    if (!user) return res.status(401).end()
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
    res.flushHeaders?.()
    res.write(`data: ${service.state.version}\n\n`)
    const off = service.subscribe((version) => res.write(`data: ${version}\n\n`))
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
    req.on('close', () => {
      off()
      clearInterval(ping)
    })
  })

  // ---------- Images (report photos, profile pictures) ----------
  // Only for signed-in users allowed to see that image (never public).
  api.get('/images/:id', requireUser(), (req, res) => {
    const row = getImage(db, req.params.id)
    if (!row) return res.status(404).json({ error: 'Image not found.' })
    if (!canViewImage(req.user, row, service.state)) return res.status(403).json({ error: 'You are not allowed to see this image.' })
    res.set({ 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' })
    res.send(Buffer.from(row.data))
  })

  // ---------- Admin tools ----------
  api.get('/admin/email-log', requireUser(['admin']), (req, res) => res.json({ config: emailConfig(), entries: emailLog(db) }))
  api.get('/admin/locations', requireUser(['admin']), (req, res) => res.json({ entries: recentLocations(db, 25) }))
  api.post('/admin/reset', requireUser(['admin']), (req, res) => {
    service.resetDemo()
    res.json(service.snapshotFor(req.user))
  })

  // ---------- Errors ----------
  api.use((req, res) => res.status(404).json({ error: 'Not found.' }))
  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large.' })
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Invalid request.' })
    console.error('CleanTrack API error:', err)
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' })
  })

  return {
    router: api,
    service,
    db,
    close() {
      if (timer) clearInterval(timer)
    },
  }
}

