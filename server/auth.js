// Passwords (scrypt) and sign-in tokens (HMAC-signed, expire after 7 days).
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const test = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return expected.length === test.length && timingSafeEqual(expected, test)
}

// The signing secret: CLEANTRACK_SECRET if set, else one generated and kept in the database.
export function getSecret(db) {
  if (process.env.CLEANTRACK_SECRET) return process.env.CLEANTRACK_SECRET
  const row = db.prepare("SELECT value FROM meta WHERE key = 'token_secret'").get()
  if (row) return row.value
  const secret = randomBytes(32).toString('hex')
  db.prepare("INSERT INTO meta (key, value) VALUES ('token_secret', ?)").run(secret)
  return secret
}

const b64 = (s) => Buffer.from(s).toString('base64url')
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export function signToken(secret, payload) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + TTL_MS }))
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken(secret, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return payload.exp > Date.now() ? payload : null
  } catch {
    return null
  }
}
