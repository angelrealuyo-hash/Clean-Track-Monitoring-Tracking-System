// Uploaded images: stored in the `uploads` table and referenced from records
// as "upl:<id>". Images arrive in actions as data URLs (already resized in the
// browser); the server validates them, stores them here, and replaces the data
// URL with the reference before saving the record.
import { randomBytes } from 'node:crypto'
import { HttpError } from './policy.js'

const MAX_BYTES = 500_000
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/

// Which actions carry an image, what kind it is, and whose it is.
const IMAGE_ACTIONS = {
  'report/add': { kind: 'report', owner: (p) => p.residentId },
  'driver/reportIssue': { kind: 'issue', owner: (p) => p.driverId ?? 'none' },
  'driver/add': { kind: 'avatar-driver', owner: () => 'new' },
  'driver/update': { kind: 'avatar-driver', owner: (p) => p.id },
  'crew/add': { kind: 'avatar-crew', owner: () => 'new' },
  'crew/update': { kind: 'avatar-crew', owner: (p) => p.id },
  'resident/update': { kind: 'avatar-resident', owner: (p) => p.id },
  'admin/setPhoto': { kind: 'avatar-admin', owner: () => 'ADMIN' },
}

export const isRef = (v) => typeof v === 'string' && /^upl:[a-f0-9]{32}$/.test(v)

/** Stores a data-URL photo in the action (if any) and returns the action with "upl:<id>" instead. */
export function storeActionImage(db, user, action) {
  const rule = IMAGE_ACTIONS[action.type]
  if (!rule) return action
  const p = action.payload
  const holder = p.patch && 'photo' in p.patch ? p.patch : p
  const value = holder.photo
  if (typeof value !== 'string' || !value.startsWith('data:')) return action
  const m = DATA_URL.exec(value)
  if (!m) throw new HttpError(400, 'Photo must be a JPG, PNG or WebP image.')
  const data = Buffer.from(m[2], 'base64')
  if (data.length > MAX_BYTES) throw new HttpError(400, 'Photo is too large (max 500 KB after resizing).')
  const id = randomBytes(16).toString('hex')
  db.prepare('INSERT INTO uploads (id, kind, owner_id, mime, data, size, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?,?)').run(
    id,
    rule.kind,
    String(rule.owner(p) ?? 'none'),
    m[1],
    data,
    data.length,
    `${user.role}:${user.refId}`,
    new Date().toISOString(),
  )
  const ref = `upl:${id}`
  const payload = holder === p ? { ...p, photo: ref } : { ...p, patch: { ...p.patch, photo: ref } }
  return { ...action, payload }
}

/** May this user see this image? Report photos: the office and the resident who sent it. */
export function canViewImage(user, row, state) {
  if (user.role === 'admin') return true
  const ref = `upl:${row.id}`
  switch (row.kind) {
    case 'report':
      return user.role === 'resident' && state.reports.some((r) => r.photo === ref && r.residentId === user.refId)
    case 'issue':
      return user.role === 'driver' && (state.driverIssues ?? []).some((x) => x.photo === ref && x.driverId === user.refId)
    case 'avatar-resident':
      return user.role === 'resident' && state.residents.some((r) => r.id === user.refId && r.photo === ref)
    case 'avatar-driver':
    case 'avatar-crew':
      // Drivers see their own picture and their crew's.
      return user.role === 'driver'
    default:
      return false
  }
}

export function getImage(db, id) {
  if (!/^[a-f0-9]{32}$/.test(id)) return null
  return db.prepare('SELECT id, kind, owner_id, mime, data FROM uploads WHERE id = ?').get(id) ?? null
}

/** Removes images no record points to any more (e.g. a replaced profile picture). */
export function removeUnusedImages(db, state) {
  const used = new Set([...JSON.stringify(state).matchAll(/upl:([a-f0-9]{32})/g)].map((m) => m[1]))
  const all = db.prepare('SELECT id FROM uploads').all().map((r) => r.id)
  const del = db.prepare('DELETE FROM uploads WHERE id = ?')
  let n = 0
  for (const id of all) {
    if (used.has(id)) continue
    del.run(id)
    n++
  }
  return n
}
