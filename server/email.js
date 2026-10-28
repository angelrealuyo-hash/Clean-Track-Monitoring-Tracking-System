// Email notifications. Every email is first written to email_log (with a unique
// event_key, so the same event never emails twice), then sent by processQueue.
// If no SMTP server is configured, the log entry is marked 'not_configured':
// nothing is sent and nothing is reported as delivered.
//
// Configure with environment variables (see .env.example):
//   SMTP_HOST, SMTP_PORT (587), SMTP_SECURE (true for port 465),
//   SMTP_USER, SMTP_PASS, MAIL_FROM
import nodemailer from 'nodemailer'
import { SAFE_EMAIL } from './policy.js'

const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [60_000, 5 * 60_000] // after 1st and 2nd failure

let transport = null
let transportKey = ''

export function emailConfig() {
  const { SMTP_HOST, MAIL_FROM } = process.env
  return { configured: Boolean(SMTP_HOST && MAIL_FROM), from: MAIL_FROM || null, host: SMTP_HOST || null }
}

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env
  if (!emailConfig().configured) return null
  const key = [SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER].join('|')
  if (!transport || key !== transportKey) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: SMTP_SECURE === 'true',
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
    transportKey = key
  }
  return transport
}

// For tests: use a fake transport instead of SMTP.
export function setTransportForTests(fake) {
  transport = fake
  transportKey = fake ? [process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_SECURE, process.env.SMTP_USER].join('|') : ''
}

/** Adds an email to the log. Returns false if this event was already queued. */
export function queueEmail(db, { eventKey, to, subject, body, relatedType = null, relatedId = null }) {
  if (!to || !SAFE_EMAIL.test(to)) return false
  const now = new Date().toISOString()
  const status = emailConfig().configured ? 'queued' : 'not_configured'
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO email_log (event_key, recipient, subject, body, status, attempts, related_type, related_id, created_at, updated_at, next_attempt_at)
       VALUES (?,?,?,?,?,0,?,?,?,?,?)`,
    )
    .run(eventKey, to, subject, body, status, relatedType, relatedId, now, now, now)
  return res.changes > 0
}

/** Sends queued emails and retries failed ones (up to 3 attempts). */
export async function processQueue(db) {
  const t = getTransport()
  if (!t) return { sent: 0, failed: 0 }
  const now = new Date().toISOString()
  const due = db
    .prepare(
      `SELECT * FROM email_log WHERE (status = 'queued' OR (status = 'failed' AND attempts < ?)) AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY id LIMIT 20`,
    )
    .all(MAX_ATTEMPTS, now)
  let sent = 0
  let failed = 0
  for (const row of due) {
    const attempts = row.attempts + 1
    try {
      const info = await t.sendMail({ from: process.env.MAIL_FROM, to: row.recipient, subject: row.subject, text: row.body })
      db.prepare("UPDATE email_log SET status = 'sent', attempts = ?, provider_response = ?, last_error = NULL, updated_at = ?, next_attempt_at = NULL WHERE id = ?").run(
        attempts,
        String(info?.response ?? info?.messageId ?? 'accepted'),
        new Date().toISOString(),
        row.id,
      )
      sent++
    } catch (err) {
      const delay = RETRY_DELAYS_MS[attempts - 1]
      db.prepare("UPDATE email_log SET status = 'failed', attempts = ?, last_error = ?, updated_at = ?, next_attempt_at = ? WHERE id = ?").run(
        attempts,
        String(err?.message ?? err).slice(0, 500),
        new Date().toISOString(),
        delay ? new Date(Date.now() + delay).toISOString() : null,
        row.id,
      )
      failed++
    }
  }
  return { sent, failed }
}

export function emailLog(db, limit = 100) {
  return db.prepare('SELECT id, event_key, recipient, subject, status, attempts, last_error, provider_response, related_type, related_id, created_at, updated_at FROM email_log ORDER BY id DESC LIMIT ?').all(limit)
}
