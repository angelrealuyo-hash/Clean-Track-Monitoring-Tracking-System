// End-to-end browser test of the whole CleanTrack workflow (Admin, Driver, Resident).
//
//   npx playwright install chromium   # once
//   npm run test:e2e
//
// It starts its own dev server with a TEMPORARY database, so your real data
// (server/data/cleantrack.db) is never touched. Screenshots go to tests/e2e/screenshots/.
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'

const tmp = mkdtempSync(join(tmpdir(), 'cleantrack-e2e-'))
process.env.DB_PATH = join(tmp, 'test.db')
process.env.CLEANTRACK_TICK_MS = '1500'
delete process.env.SMTP_HOST
const OUT = join(import.meta.dirname, 'screenshots')
mkdirSync(OUT, { recursive: true })

const { createServer } = await import('vite')
const vite = await createServer({ configFile: join(import.meta.dirname, '../../vite.config.js'), server: { port: 0, strictPort: false }, logLevel: 'error' })
await vite.listen()
const B = vite.resolvedUrls.local[0].replace(/\/$/, '')

const res = []
const errors = []
const check = (n, ok, x = '') => res.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  (' + x + ')' : ''}`)
const seen = (loc, t = 8000) => loc.first().waitFor({ timeout: t }).then(() => true).catch(() => false)
const gone = (loc, t = 8000) => loc.first().waitFor({ state: 'detached', timeout: t }).then(() => true).catch(() => false)
const step = async (name, fn) => {
  try {
    await fn()
  } catch (e) {
    check(`${name} (step crashed)`, false, e.message.split('\n')[0])
  }
}
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TODAY = DAYS[new Date().getDay()]

// What the SERVER saved (admin view).
let ADMIN_TOKEN
const serverState = async () => {
  ADMIN_TOKEN ??= (await (await fetch(`${B}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'admin', identifier: 'admin@cleantrack.gov', password: 'SuperAdmin#2025' }) })).json()).token
  return (await (await fetch(`${B}/api/state`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })).json()).data
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
const watch = (pg) => {
  pg.on('pageerror', (e) => errors.push(e.message))
  pg.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  return pg
}
const a = watch(await ctx.newPage())
const d = watch(await ctx.newPage())
await d.setViewportSize({ width: 390, height: 844 })
const r = watch(await ctx.newPage())
await r.setViewportSize({ width: 390, height: 844 })
const nav = async (label, h) => {
  await a.locator('.admin-nav').getByRole('link', { name: label }).click()
  await a.locator('.admin-page h1', { hasText: h ?? label }).waitFor()
}

try {
  await step('0. Sign-in and permissions', async () => {
    await a.goto(`${B}/admin/settings`)
    check('0a Protected page redirects to sign-in', await a.waitForURL('**/admin/login').then(() => true).catch(() => false))
    await a.fill('#admin-email', 'admin@cleantrack.gov')
    await a.fill('#admin-password', 'wrong-password')
    await a.getByRole('button', { name: 'Sign In', exact: true }).click()
    check('0b Wrong password shows the server error', await seen(a.getByRole('alert').getByText('Wrong email or password.')))
    await a.getByRole('button', { name: 'Auto Fill' }).click()
    await a.getByRole('button', { name: 'Sign In', exact: true }).click()
    check('0c Admin signs in (server token)', await a.waitForURL('**/admin/settings').then(() => true).catch(() => false))
    const resToken = (await (await fetch(`${B}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'resident', identifier: '0917 555 0192', password: 'resident123' }) })).json()).token
    const forbidden = await fetch(`${B}/api/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resToken}` }, body: JSON.stringify({ type: 'settings/update', payload: { completionTarget: 50 } }) })
    check('0d Resident token cannot change admin settings (403)', forbidden.status === 403)
  })

  await step('1. Admin creates schedule and route', async () => {
    await nav('Routes & Schedules')
    await a.getByRole('button', { name: 'Add Pickup Point' }).click()
    await a.fill('#as-name', 'New Corner (demo)')
    await a.selectOption('#as-purok', 'Purok 3')
    await a.fill('#as-hh', '18')
    await a.selectOption('#as-after', { label: '5. Demo Stop 4' })
    const box = await a.locator('.add-stop-map').boundingBox()
    await a.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.45)
    await a.getByRole('dialog').getByRole('button', { name: 'Add to Route' }).click()
    await gone(a.getByRole('dialog'))
    const rows = await a.locator('table').first().locator('tbody tr strong').allTextContents()
    check('1a Pickup point added after Demo Stop 4 (saved on server)', rows[5] === 'New Corner (demo)' && (await serverState()).route.stops.some((s) => s.name === 'New Corner (demo)'))
    await a.getByRole('button', { name: `Edit ${TODAY}` }).click()
    await a.selectOption('#sc-type', 'Recyclables (Plastics, Cartons, Metals)')
    await a.fill('#sc-start', '07:00')
    await a.fill('#sc-end', '11:00')
    await a.getByRole('dialog').getByRole('button', { name: 'Save Schedule' }).click()
    check(`1b Today's (${TODAY}) schedule saved on server`, await seen(a.locator('tr', { hasText: TODAY }).getByText('07:00 AM - 11:00 AM')) && (await serverState()).weeklySchedule.find((x) => x.day === TODAY).window === '07:00 AM - 11:00 AM')
    await a.screenshot({ path: join(OUT, 'admin-routes.png'), fullPage: true })
  })

  await step('2. Truck/driver assignment and conflict checks', async () => {
    await nav('Truck Management')
    await a.getByRole('button', { name: 'Edit Vehicle', exact: true }).click()
    await a.selectOption('#t-status', 'maintenance')
    await a.getByRole('button', { name: 'Update Vehicle' }).click()
    await gone(a.getByRole('dialog'))
    await d.goto(`${B}/driver/login`)
    await d.locator('.m-auth__quick').click()
    await d.waitForURL('**/driver')
    check('2a Truck in maintenance: Start Route disabled with reason', (await seen(d.getByText(/being repaired/))) && (await d.getByRole('button', { name: /Start Route/ }).isDisabled()))
    await a.getByRole('button', { name: 'Edit Vehicle', exact: true }).click()
    await a.selectOption('#t-status', 'active')
    await a.getByRole('button', { name: 'Update Vehicle' }).click()
    check('2b Back to Active (live update to driver tab)', await d.getByRole('button', { name: /Start Route/ }).isEnabled({ timeout: 8000 }))
  })

  await step('3-4. Driver starts route; simulated truck shared across tabs', async () => {
    check("3a Driver sees today's pickup", await seen(d.getByText(/Recyclables · 07:00 AM - 11:00 AM/)))
    await d.getByRole('button', { name: /Start Route/ }).click()
    await d.getByText('Route started').waitFor({ timeout: 8000 }).catch(() => {})
    const s1 = await serverState()
    check('3b Run saved on the server', Boolean(s1.activeRunId) && s1.runs[0].startedBy === 'driver' && s1.simulation.status === 'running')
    await nav('Live Tracking')
    check('4a "SIMULATED GPS — DEMO MODE" label', await seen(a.getByText('SIMULATED GPS — DEMO MODE')))
    const p1 = await a.getByTestId('truck-position').textContent()
    await a.waitForTimeout(2500)
    check('4b Admin tab sees the truck the driver started', p1 !== (await a.getByTestId('truck-position').textContent()))
    check('4c Truck waits at the first pickup point', await seen(a.getByText(/waiting at/i), 15000))
    check('4d Current stop shown', await seen(a.locator('.lt-detail dd', { hasText: 'Demo Stop 1' })))
    check('4e Simulated location history saved', await seen(a.locator('.lt-log tbody tr')))
    await a.screenshot({ path: join(OUT, 'admin-live.png'), fullPage: true })
  })

  await step('5-6. Driver records pickups; admin updates', async () => {
    await d.goto(`${B}/driver/collection?stop=STP-02`)
    await d.getByRole('button', { name: 'Mark as Collected' }).click()
    await d.waitForURL(/stop=STP-03/)
    const rec = (await serverState()).runs[0].results['STP-02']
    check('5a Record saved: driver, time, bags', rec?.by === 'driver' && rec.byName === 'Carlos Ortiz' && rec.bags > 0)
    check('5b Truck moves on after the record', await gone(a.getByText(/waiting at Demo Stop 1/i), 10000))
    await nav('Collection Monitoring')
    check('6a Collection Monitoring shows the driver record', await seen(a.locator('tbody tr', { hasText: 'Demo Stop 1' }).getByText('by Carlos Ortiz (driver)')))
    await nav('Dashboard', 'Barangay Waste Management')
    check('6b Dashboard progress 1 / 9', await seen(a.locator('.stat-card', { hasText: 'Collection Progress' }).getByText('1 / 9')))
    check('6c Dashboard upcoming pickups', await seen(a.getByText('Upcoming')))
    await a.screenshot({ path: join(OUT, 'admin-dashboard.png'), fullPage: true })
  })

  let rid
  await step('7-8. Resident: schedule, truck, report', async () => {
    await r.goto(`${B}/resident/login`)
    await r.fill('#res-email', '0917 555 0192')
    await r.fill('#res-password', 'resident123')
    await r.getByRole('button', { name: /Sign In as Resident/ }).click()
    check('7a Resident signs in with mobile number', await r.waitForURL(/\/resident$/).then(() => true).catch(() => false))
    check("7b Home shows today's pickup", await seen(r.getByRole('heading', { name: /Recyclables/ })))
    check('7c Pickup-day reminder (server, in-app)', await seen(r.getByText(/Pickup today/), 10000))
    await r.goto(`${B}/resident/reports/new`)
    await r.getByRole('button', { name: /Send to Barangay/ }).click()
    await r.waitForURL(/\/resident\/reports\/REP-/)
    rid = r.url().split('/').pop()
    check('8a Report sent with one tap; server number; Submitted', (await seen(r.locator('.m-steps li.is-done', { hasText: 'Submitted' }))) && (await serverState()).reports.some((x) => x.id === rid), rid)
    await r.screenshot({ path: join(OUT, 'resident-report.png'), fullPage: true })
  })

  await step('9. Admin reviews and resolves', async () => {
    await a.goto(`${B}/admin/resident-reports?id=${rid}`)
    await a.getByRole('heading', { name: `Report #${rid}` }).waitFor()
    await a.getByRole('button', { name: 'Start Reviewing' }).click()
    check('9a Resident sees Reviewing (live)', await seen(r.locator('.m-steps li.is-done', { hasText: 'Reviewing' })))
    await a.getByRole('button', { name: 'Mark Resolved' }).click()
    check('9b Resolve without a reply is refused', await seen(a.getByText(/Write a short response|Write a response/)))
    await a.fill('#rep-response', 'The driver will come back for your bags by 3 PM.')
    await a.getByRole('button', { name: 'Mark Resolved' }).click()
    check('9c Resident sees Resolved + reply', (await seen(r.locator('.m-steps li.is-done', { hasText: 'Resolved' }))) && (await seen(r.getByText('The driver will come back for your bags by 3 PM.'))))
  })

  await step('10. End route; analytics; persistence', async () => {
    await d.goto(`${B}/driver/collection?stop=STP-08`)
    await d.getByRole('button', { name: 'Report a Problem Here' }).click()
    await d.fill('#di-desc', 'Van blocking the alley.')
    await d.getByRole('button', { name: 'Send to the Office' }).click()
    await d.goto(`${B}/driver`)
    await d.getByRole('button', { name: 'End Route' }).click()
    await d.getByRole('dialog').getByRole('button', { name: 'End Route' }).click()
    await d.getByText('Route ended and saved').waitFor({ timeout: 8000 }).catch(() => {})
    const s = await serverState()
    check('10a Run saved as ended early (1 collected, 1 missed)', s.activeRunId === null && s.runs[0].status === 'ended-early' && Object.keys(s.runs[0].results).length === 2)
    await nav('Reports & Analytics')
    check('10b Analytics row from saved run', await seen(a.locator('tbody tr', { hasText: s.runs[0].id }).getByText('Ended early')))
    await a.reload()
    await a.locator('.admin-page h1').waitFor()
    check('10c Records persist after reload', await seen(a.locator('tbody tr', { hasText: s.runs[0].id })))
    await a.screenshot({ path: join(OUT, 'admin-analytics.png'), fullPage: true })
  })

  await step('Notifications and email honesty', async () => {
    await nav('Notifications', 'Notifications & Alerts')
    await a.getByRole('button', { name: 'Notify Residents' }).click()
    await a.selectOption('#b-zone', 'Purok 2')
    await a.fill('#b-subject', 'Truck late today')
    await a.fill('#b-message', 'The truck will arrive about 30 minutes late.')
    await a.getByRole('dialog').getByText('Also email residents').click()
    await a.getByRole('dialog').getByRole('button', { name: 'Send Broadcast' }).click()
    check('N1 Outbox: in-app delivered; email "not configured" (not sent)', (await seen(a.locator('tr', { hasText: 'Truck late today' }).getByText('In-app: delivered'))) && (await seen(a.locator('tr', { hasText: 'Truck late today' }).getByText(/not sent \(not configured\)/))))
    await a.getByRole('tab', { name: /Email Log/ }).click()
    check('N2 Email log lists attempts as not configured', await seen(a.getByText('Not sent: email not configured')))
    await a.getByRole('tab', { name: /Dispatch Feed/ }).click()
    check('N3 Driver problem reached admin', await seen(a.getByText(/Driver issue at Demo Stop 7/)))
    await r.goto(`${B}/resident/notifications`)
    check('N4 Resident got the broadcast', await seen(r.getByText('Truck late today')))
    await r.locator('article', { hasText: 'Truck late today' }).getByRole('button', { name: 'Mark as read' }).click()
    check('N5 Per-person read state saved', await gone(r.locator('article', { hasText: 'Truck late today' }).getByRole('button', { name: 'Mark as read' })))
  })

  await step('Truck-approaching alert (simulated rule)', async () => {
    await nav('Live Tracking')
    await a.getByRole('button', { name: /Restart|Start Simulation/ }).click()
    await a.waitForTimeout(5000)
    const s = await serverState()
    check('P1 "Truck is coming" for Purok 1, created by the server', s.notifications.some((n) => n.kind === 'proximity' && n.zone === 'Purok 1'))
    await a.getByRole('button', { name: 'Reset' }).click()
    check('P2 Reset returns the truck to the depot', await seen(a.getByRole('button', { name: 'Start Simulation' })))
  })

  await step('Simplified sign-up and invalid input', async () => {
    const n = watch(await ctx.newPage())
    await n.setViewportSize({ width: 390, height: 844 })
    await n.goto(`${B}/resident/register`)
    await n.locator('#su-name').waitFor()
    await n.fill('#su-name', 'Pedro Santos')
    await n.fill('#su-phone', '0917 555 0192')
    await n.fill('#su-street', 'Lot 3, Demo St.')
    await n.fill('#su-pw', 'pedro1')
    await n.getByRole('button', { name: 'Create Account' }).click()
    check('S1 Duplicate mobile number refused by server', await seen(n.getByText(/already has an account/)))
    await n.fill('#su-phone', '0918 111 2233')
    await n.getByRole('button', { name: 'Create Account' }).click()
    check('S2 Account created (no email needed)', await n.waitForURL(/\/resident$/).then(() => true).catch(() => false))
    await n.close()
  })

  await step('No barangay name on screens', async () => {
    const hits = []
    const pages = [[a, '/admin'], [a, '/admin/live-tracking'], [a, '/admin/truck'], [a, '/admin/drivers'], [a, '/admin/routes'], [a, '/admin/collection'], [a, '/admin/resident-reports'], [a, '/admin/notifications'], [a, '/admin/analytics'], [a, '/admin/settings'], [r, '/resident'], [r, '/resident/track'], [r, '/resident/schedule'], [r, '/resident/reports'], [r, '/resident/reports/new'], [r, '/resident/notifications'], [r, '/resident/profile'], [d, '/driver'], [d, '/driver/route'], [d, '/driver/collection'], [d, '/driver/profile']]
    for (const [pg, p] of pages) {
      await pg.goto(B + p)
      await pg.locator('.admin-page, .m-page').first().waitFor()
      await pg.waitForTimeout(200)
      const t = await pg.locator('body').innerText()
      const hit = t.match(/Rizal|Taguig/i)
      if (hit) hits.push(`${p}: ${hit[0]}`)
    }
    const signedOut = watch(await browser.newPage())
    for (const p of ['/', '/admin/login', '/resident/login', '/resident/register', '/driver/login']) {
      await signedOut.goto(B + p)
      await signedOut.waitForTimeout(300)
      const hit = (await signedOut.locator('body').innerText()).match(/Rizal|Taguig/i)
      if (hit) hits.push(`${p}: ${hit[0]}`)
    }
    await signedOut.close()
    check('No "Rizal" or "Taguig" on any screen (26 screens)', hits.length === 0, hits.join('; '))
  })

  await step('Responsive and no bin wording', async () => {
    const m = watch(await ctx.newPage())
    await m.setViewportSize({ width: 390, height: 844 })
    const wide = []
    for (const p of ['/admin', '/admin/live-tracking', '/admin/routes', '/admin/collection', '/admin/drivers', '/admin/analytics', '/admin/settings', '/admin/notifications?tab=email']) {
      await m.goto(B + p)
      await m.locator('.admin-page').first().waitFor()
      await m.waitForTimeout(300)
      if (!(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))) wide.push(p)
    }
    check('Phone: admin screens do not scroll sideways', wide.length === 0, wide.join(', '))
    const hits = []
    for (const [pg, p] of [[r, '/resident'], [r, '/resident/schedule'], [r, '/resident/reports/new'], [d, '/driver'], [d, '/driver/route'], [d, '/driver/collection']]) {
      await pg.goto(B + p)
      await pg.locator('.m-page').first().waitFor()
      const t = await pg.locator('.mobile-frame').innerText()
      const hit = t.match(/green bin|blue bin|\bbins?\b/i)
      if (hit) hits.push(`${p}: ${hit[0]}`)
    }
    check('No bin wording on Resident/Driver screens', hits.length === 0, hits.join('; '))
  })
} finally {
  await browser.close()
  await vite.close()
  rmSync(tmp, { recursive: true, force: true })
}

const real = errors.filter((e) => !/tile\.openstreetmap|net::ERR|Failed to load resource/.test(e))
console.log(res.join('\n'))
const passed = res.filter((x) => x.startsWith('PASS')).length
console.log(`\n${passed}/${res.length} passed`)
console.log('Browser console errors:', real.length ? real : 'none')
process.exit(passed === res.length && real.length === 0 ? 0 : 1)
