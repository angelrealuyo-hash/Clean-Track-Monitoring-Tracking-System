// Run with: npm test
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { openDatabase } from '../server/db.js'
import { queueEmail, processQueue, setTransportForTests } from '../server/email.js'

after(() => {
  setTransportForTests(null)
  delete process.env.SMTP_HOST
  delete process.env.MAIL_FROM
})

test('not configured: logged as not_configured, never sent', async () => {
  delete process.env.SMTP_HOST
  const db = openDatabase(':memory:')
  assert.equal(queueEmail(db, { eventKey: 'k1', to: 'maria@example.com', subject: 'Hi', body: 'x' }), true)
  assert.equal((await processQueue(db)).sent, 0)
  assert.equal(db.prepare('SELECT status FROM email_log').get().status, 'not_configured')
})

test('configured: failure is retried, success is recorded with the provider response; duplicates ignored', async () => {
  process.env.SMTP_HOST = 'smtp.test'
  process.env.MAIL_FROM = 'CleanTrack <no-reply@example.com>'
  let calls = 0
  setTransportForTests({
    sendMail: async () => {
      calls++
      if (calls === 1) throw new Error('Connection timed out')
      return { response: '250 OK queued as 123' }
    },
  })
  const db = openDatabase(':memory:')
  assert.equal(queueEmail(db, { eventKey: 'report:1', to: 'maria@example.com', subject: 'Update', body: 'x' }), true)
  assert.equal(queueEmail(db, { eventKey: 'report:1', to: 'maria@example.com', subject: 'Update', body: 'x' }), false, 'same event not queued twice')
  assert.equal(queueEmail(db, { eventKey: 'bad', to: '"x;y"<a@b.com>', subject: 's', body: 'b' }), false, 'unsafe address refused')

  await processQueue(db)
  let row = db.prepare('SELECT * FROM email_log').get()
  assert.equal(row.status, 'failed')
  assert.equal(row.attempts, 1)
  assert.match(row.last_error, /timed out/)

  db.prepare('UPDATE email_log SET next_attempt_at = ?').run(new Date(Date.now() - 1000).toISOString()) // retry time reached
  await processQueue(db)
  row = db.prepare('SELECT * FROM email_log').get()
  assert.equal(row.status, 'sent')
  assert.equal(row.attempts, 2)
  assert.equal(row.provider_response, '250 OK queued as 123')
  assert.equal(calls, 2)
})
