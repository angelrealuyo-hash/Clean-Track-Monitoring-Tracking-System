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

// The full workflow drives a real route, which only runs on collection days.
if (!['Monday', 'Wednesday', 'Friday'].includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }))) {
  console.log('This browser test needs a collection day (Monday, Wednesday or Friday): regular routes are refused on other days.')
  console.log('The unit/API tests (npm test) run on any day.')
  process.exit(1)
}
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
const PICTURE = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('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', 'base64') }
// An <img> that really loaded (not broken).
const loaded = (loc) => loc.first().evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false)
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
    check('1b0 Only Mon/Wed/Fri can be edited', (await a.getByRole('button', { name: 'Edit Tuesday' }).count()) === 0 && (await a.getByRole('button', { name: 'Edit Monday' }).count()) === 1)
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
    check("3a Driver sees today's pickup", await seen(d.getByText(/Collection day · 07:00 AM - 11:00 AM/)))
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
    const tabs = await d.locator('.mobile-tabs a').allTextContents()
    check('5-0 Driver has exactly 3 tabs: Home, My Route, Profile', tabs.join(',') === 'Home,My Route,Profile', tabs.join(','))
    await d.locator('.mobile-tabs').getByRole('link', { name: 'My Route' }).click()
    const active = d.locator('.drv-stop--active')
    check('5-1 Next pending stop is on top', await seen(active.getByText('Demo Stop 1')))
    await active.getByRole('button', { name: 'Mark as Collected' }).click()
    await d.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
    await gone(d.getByRole('dialog'))
    check('5-2 Cancel changes nothing', !(await serverState()).runs[0].results['STP-02'] && (await seen(active.getByText('Demo Stop 1'))))
    await active.getByRole('button', { name: 'Mark as Collected' }).click()
    check('5-3 No bag count asked when marking a stop', (await d.locator('#drv-bags').count()) === 0)
    const yes = d.getByRole('dialog').getByRole('button', { name: /Yes, collected|Saving/ })
    await yes.click()
    await yes.click({ timeout: 500 }).catch(() => {}) // double tap
    await gone(d.getByRole('dialog'))
    const rec = (await serverState()).runs[0].results['STP-02']
    check('5a Record saved: driver, time, bags', rec?.by === 'driver' && rec.byName === 'Carlos Ortiz' && rec.bags === null)
    check('5a2 Next stop moves to the top; done stop at the bottom', (await seen(active.getByText('Demo Stop 2'))) && (await seen(d.locator('.drv-stop.is-collected', { hasText: 'Demo Stop 1' }))))
    check('5a3 Fixed progress shows 1/9', await seen(d.locator('.drv-progress-bar').getByText('Progress: 1/9')))
    await d.screenshot({ path: join(OUT, 'driver-route.png') })
    check('5a4 END MY SHIFT hidden while stops remain', (await d.getByRole('button', { name: 'END MY SHIFT' }).count()) === 0)
    await d.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await d.waitForTimeout(200)
    const stuck = await d.evaluate(() => {
      const bar = document.querySelector('.drv-progress-bar').getBoundingClientRect()
      const head = document.querySelector('.mobile-header').getBoundingClientRect()
      return window.scrollY > 0 && Math.abs(bar.top - head.bottom) <= 2
    })
    check('5a5 Progress bar stays under the header while scrolling (phone)', stuck)
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
    check("7b Home shows today's pickup (no waste type)", await seen(r.getByRole('heading', { name: 'Garbage pickup today' })))
    check('7c Pickup-day reminder (server, in-app)', await seen(r.getByText(/Garbage pickup today, /), 10000))
    const fb = r.locator('.res-feedback')
    check('7d Asks "Are you planning to dispose of your garbage today?"', await seen(fb.getByText('Are you planning to dispose of your garbage today?')))
    if (new Date().getHours() >= 6) {
      await r.goto(`${B}/resident/notifications`)
      const note = r.locator('article', { hasText: 'Today’s Pick Up Check!' })
      check("7d2 Today's Pick Up Check message with YES / NO", (await seen(note)) && (await seen(note.getByRole('button', { name: 'YES' }))))
      await note.getByRole('button', { name: 'YES' }).click()
      await r.waitForURL(/\/resident#pickup-check/)
    } else {
      check('7d2 (skipped: before 6 AM the check is not due yet)', true)
      await fb.getByRole('button', { name: 'YES' }).click()
    }
    check('7e Then asks if the truck passed', await seen(fb.getByText('Did the garbage truck pass your location?')))
    await fb.getByRole('button', { name: 'NO' }).click()
    check('7f Then asks why (reason form)', await seen(fb.getByText('Why were you unable to dispose of your garbage?')))
    await fb.getByText('The truck did not pass by').click()
    await fb.locator('#fb-text').fill('No truck on our street this morning.')
    await fb.getByRole('button', { name: /Send to the Barangay/ }).click()
    check('7g Check closes itself after the last answer is saved (back to Home)', (await seen(r.locator('.res-feedback.is-closed'))) && !r.url().includes('#pickup-check') && (await seen(r.getByText(/^Saved!/))))
    await r.reload()
    await r.locator('.res-feedback').waitFor()
    check('7g2 Still closed after refresh (no new prompt)', (await r.locator('.res-feedback.is-closed').count()) === 1 && (await r.getByText('Are you planning to dispose of your garbage today?').count()) === 0)
    await fb.screenshot({ path: join(OUT, 'resident-feedback.png') })
    const fbRec = (await serverState()).collectionFeedback[0]
    check('7h Saved on server, answers kept separately', fbRec?.willDispose === true && fbRec.truckPassed === false && fbRec.disposed === false && fbRec.reason === 'truck-did-not-pass' && Boolean(fbRec.reportId))
    await r.goto(`${B}/resident/reports/new`)
    await r.locator('input[type=file]').setInputFiles(PICTURE)
    check('8-0 Photo preview before sending', await seen(r.getByText('Photo attached')))
    await r.getByRole('button', { name: /Send to Barangay/ }).click()
    await r.waitForURL(/\/resident\/reports\/REP-/)
    rid = r.url().split('/').pop()
    check('8a Report sent with one tap; server number; Submitted', (await seen(r.locator('.m-steps li.is-done', { hasText: 'Submitted' }))) && (await serverState()).reports.some((x) => x.id === rid), rid)
    const savedPhoto = (await serverState()).reports.find((x) => x.id === rid)?.photo
    check('8b Photo saved with the report (private reference)', /^upl:[a-f0-9]{32}$/.test(savedPhoto ?? ''), savedPhoto)
    check('8c Resident sees own photo', await loaded(r.locator('img.res-photo-full')))
    await r.screenshot({ path: join(OUT, 'resident-report.png'), fullPage: true })
  })

  await step('9. Admin reviews and resolves', async () => {
    await a.goto(`${B}/admin/resident-reports?id=${rid}`)
    await a.getByRole('heading', { name: `Report #${rid}` }).waitFor()
    check('9-0 Admin sees the attached photo', await loaded(a.locator('img.report-photo')))
    await a.locator('.ct-img-btn').click()
    check('9-0b Larger view opens', await loaded(a.getByRole('dialog').locator('img.ct-photo-full')))
    await a.screenshot({ path: join(OUT, 'admin-report-photo.png') })
    await a.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
    await a.reload()
    await a.getByRole('heading', { name: `Report #${rid}` }).waitFor()
    check('9-0c Photo still there after refresh', await loaded(a.locator('img.report-photo')))
    await a.getByRole('button', { name: 'Start Reviewing' }).click()
    check('9a Resident sees Reviewing (live)', await seen(r.locator('.m-steps li.is-done', { hasText: 'Reviewing' })))
    await a.getByRole('button', { name: 'Mark Resolved' }).click()
    check('9b Resolve without a reply is refused', await seen(a.getByText(/Write a short response|Write a response/)))
    await a.fill('#rep-response', 'The driver will come back for your bags by 3 PM.')
    await a.getByRole('button', { name: 'Mark Resolved' }).click()
    check('9c Resident sees Resolved + reply', (await seen(r.locator('.m-steps li.is-done', { hasText: 'Resolved' }))) && (await seen(r.getByText('The driver will come back for your bags by 3 PM.'))))
  })

  await step('10. End route; analytics; persistence', async () => {
    await d.goto(`${B}/driver`)
    await d.getByRole('link', { name: /Report a Problem/ }).click()
    await d.waitForURL('**/driver/report')
    await d.selectOption('.m-page select', 'STP-08')
    await d.fill('#di-desc', 'Van blocking the alley.')
    await d.getByText('I could not pick up at this stop').click()
    await d.getByRole('button', { name: 'Send to the Office' }).click()
    await d.waitForURL(/\/driver$/)
    await d.screenshot({ path: join(OUT, 'driver-home.png'), fullPage: true })
    check('10-1 Driver problem saved for the office', (await serverState()).driverIssues.some((x) => x.stopId === 'STP-08' && x.markedMissed))
    check("10-2 Home: Today's Progress 1/9", await seen(d.getByText('1/9')))
    await d.goto(`${B}/driver/route`)
    for (let i = 0; i < 7; i++) {
      await d.locator('.drv-stop--active').getByRole('button', { name: 'Mark as Collected' }).click()
      await d.getByRole('dialog').getByRole('button', { name: 'Yes, collected' }).click()
      await gone(d.getByRole('dialog'))
    }
    check('10-3a Stop that could not be picked up stays to do; no END MY SHIFT yet', (await seen(d.getByText('Go Back to These Stops'))) && (await d.getByRole('button', { name: 'END MY SHIFT' }).count()) === 0 && (await d.locator('.ct-celebrate').count()) === 0)
    const early = await fetch(`${B}/api/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await (await fetch(`${B}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'driver', identifier: 'driver.ortiz@cleantrack.ph', password: 'driver123' }) })).json()).token}` }, body: JSON.stringify({ type: 'run/end', payload: {} }) })
    check('10-3b Server refuses ending the shift early', early.status === 409, String(early.status))
    await d.locator('.drv-stop.is-missed').getByRole('button', { name: 'Mark as Collected' }).click()
    await d.getByRole('dialog').getByRole('button', { name: 'Yes, collected' }).click()
    check('10-3c Confetti + "Route Complete!" after the last stop', await seen(d.locator('.ct-celebrate').getByText('Route Complete! 🎉')))
    check('10-3 All done: completion message + END MY SHIFT', (await seen(d.getByText('Route complete! All stops collected.'))) && (await seen(d.getByRole('button', { name: 'END MY SHIFT' }))))
    await d.screenshot({ path: join(OUT, 'driver-route-done.png') })
    await gone(d.locator('.ct-celebrate'), 6000)
    await d.reload()
    await d.locator('.drv-finish').waitFor()
    await d.waitForTimeout(500)
    check('10-3d Reload does not replay the confetti', (await d.locator('.ct-celebrate').count()) === 0)
    await d.goto(`${B}/driver/profile`)
    await d.locator('.m-page').waitFor()
    check('10-3e Driver Profile has no End My Shift', (await d.getByText(/End My Shift/i).count()) === 0)
    await d.goto(`${B}/driver/route`)
    await d.getByRole('button', { name: 'END MY SHIFT' }).click()
    await d.getByRole('dialog').getByRole('button', { name: 'Yes, end my shift' }).click()
    check('10-4 Shift ended message', await seen(d.locator('.drv-finish').getByText('Shift ended')))
    const s = await serverState()
    const results = Object.values(s.runs[0].results)
    check('10a Run saved as completed (9 collected, end time)', s.activeRunId === null && s.runs[0].status === 'completed' && Boolean(s.runs[0].endedAt) && results.filter((x) => x.status === 'collected').length === 9)
    await nav('Collection Monitoring')
    check('10a2 Collection Monitoring: shift ended + driver problem listed', (await seen(a.getByText(/driver ended the shift/))) && (await seen(a.locator('.collection-issues').getByText('Van blocking the alley.'))))
    await nav('Reports & Analytics')
    check('10b Analytics row from saved run', await seen(a.locator('tbody tr', { hasText: s.runs[0].id }).getByText('Completed')))
    const fa = a.locator('.feedback-analytics')
    check('10b2 Participation: resident answer counted, labelled resident-reported', /^1\s*of/.test(await fa.locator('.stat-card', { hasText: 'Residents Who Answered' }).locator('.stat-card__value').innerText()) && (await seen(fa.getByText('Resident-reported'))))
    check('10b3 Driver-confirmed stops shown separately (9 of 9)', await seen(fa.locator('.stat-card', { hasText: 'Stops Collected' }).getByText(/9\s*of 9 stops/)))
    check('10b4 Feedback needing attention lists the reason', await seen(fa.getByText('No truck on our street this morning.')))
    await fa.screenshot({ path: join(OUT, 'admin-participation.png') })
    await a.reload()
    await a.locator('.admin-page h1').waitFor()
    check('10c Records persist after reload', await seen(a.locator('tbody tr', { hasText: s.runs[0].id })))
    await a.screenshot({ path: join(OUT, 'admin-analytics.png'), fullPage: true })
  })

  await step('Crew, profile links, My Account', async () => {
    const side = await a.locator('.admin-nav').innerText()
    check("C0 Sidebar: Collector's Management; no Driver/Crew Management or Settings", side.includes("Collector's Management") && !/Driver Management|Crew Management|\bSettings\b/.test(side))
    await nav("Collector's Management")
    check('C0b Truck tab shows its driver as a card', await seen(a.locator('.col-card', { hasText: 'Carlos Ortiz' }).getByText('Driver')))
    await a.getByRole('button', { name: 'Add Crew Member' }).first().click()
    await a.fill('#c-name', 'Ben Reyes')
    await a.getByRole('dialog').locator('input[type=file]').setInputFiles(PICTURE)
    await a.getByRole('dialog').getByRole('button', { name: 'Change Picture' }).waitFor()
    await a.selectOption('#c-role', 'Helper / Loader')
    await a.getByRole('dialog').getByRole('button', { name: 'Add Crew Member' }).click()
    await gone(a.getByRole('dialog'))
    check('C1 Crew member added (saved on server)', (await seen(a.locator('.col-card', { hasText: 'Ben Reyes' }))) && (await serverState()).crew.some((c) => c.name === 'Ben Reyes' && c.truckId === 'TRK-01'))
    await a.getByRole('button', { name: 'Edit Ben Reyes' }).click()
    await a.selectOption('#c-status', 'inactive')
    await a.getByRole('dialog').getByRole('button', { name: 'Update Crew Member' }).click()
    await gone(a.getByRole('dialog'))
    check('C2 Crew member edited', (await serverState()).crew.find((c) => c.name === 'Ben Reyes')?.status === 'inactive')
    check('C3 Crew picture saved and shown in the list', /^upl:/.test((await serverState()).crew.find((c) => c.name === 'Ben Reyes')?.photo ?? '') && (await loaded(a.locator('.col-card', { hasText: 'Ben Reyes' }).locator('img'))))
    const tabs2 = await a.locator('.col-tab').allInnerTexts()
    check('C3b Tabs come from the saved trucks + Unassigned', tabs2.length === 2 && tabs2[0].includes('TRK-01') && tabs2[1].includes('Unassigned'))
    const look = await a.locator('.col-card', { hasText: 'Carlos Ortiz' }).evaluate((el) => {
      const av = el.querySelector('.col-card__avatar').getBoundingClientRect()
      const nm = getComputedStyle(el.querySelector('.col-card__name'))
      return { w: av.width, h: av.height, weight: Number(nm.fontWeight), size: parseFloat(nm.fontSize) }
    })
    check('C3c Large round picture, bold name', look.w >= 96 && look.w === look.h && look.weight >= 700 && look.size >= 16, JSON.stringify(look))
    await a.getByRole('tab', { name: /Unassigned/ }).click()
    check('C3d Unassigned tab: only people with no truck', (await seen(a.locator('.col-card', { hasText: 'Mateo Reyes' }))) && (await a.locator('.col-card', { hasText: 'Carlos Ortiz' }).count()) === 0)
    await a.locator('.col-card', { hasText: 'Mateo Reyes' }).locator('.col-card__open').click()
    check('C3e Details open from the card, with management actions', (await seen(a.getByRole('dialog').getByRole('button', { name: /Assign to TRK-01/ }))) && (await seen(a.getByRole('dialog').getByRole('button', { name: 'Remove' }))))
    await a.screenshot({ path: join(OUT, 'admin-collector-details.png') })
    await a.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
    await a.getByRole('tab', { name: /TRK-01/ }).click()
    // Driver picture (edit the driver).
    await a.getByRole('button', { name: 'Edit Carlos Ortiz' }).click()
    await a.getByRole('dialog').locator('input[type=file]').setInputFiles(PICTURE)
    await a.getByRole('dialog').getByRole('button', { name: 'Change Picture' }).waitFor()
    await a.getByRole('dialog').getByRole('button', { name: 'Update Driver' }).click()
    await gone(a.getByRole('dialog'))
    const st = await serverState()
    const carlosPhoto = st.drivers.find((x) => x.id === 'DRV-01')?.photo
    check('C4 Driver picture saved; crew picture unchanged', /^upl:/.test(carlosPhoto ?? '') && carlosPhoto !== st.crew.find((c) => c.name === 'Ben Reyes')?.photo)
    // An active crew member on the truck appears in the Driver app.
    await a.getByRole('button', { name: 'Add Crew Member' }).first().click()
    await a.fill('#c-name', 'Lito Ramos')
    await a.getByRole('dialog').locator('input[type=file]').setInputFiles(PICTURE)
    await a.getByRole('dialog').getByRole('button', { name: 'Change Picture' }).waitFor()
    await a.getByRole('dialog').getByRole('button', { name: 'Add Crew Member' }).click()
    await gone(a.getByRole('dialog'))
    await d.goto(`${B}/driver`)
    const crewCard = d.locator('section', { hasText: 'My Crew' })
    check('D1 Driver Home: My Crew shows the active crew with picture', (await seen(crewCard.getByText('Lito Ramos'))) && !(await crewCard.innerText()).includes('Ben Reyes') && (await loaded(crewCard.locator('img'))))
    check('D2 Driver Home: own picture shown', await loaded(d.locator('.m-card').first().locator('img')))
    await d.goto(`${B}/driver/profile`)
    check('D3 Driver Profile: My Crew', await seen(d.locator('section', { hasText: 'My Crew' }).getByText('Lito Ramos')))
    let driverText = ''
    for (const p of ['/driver', '/driver/route', '/driver/profile']) {
      await d.goto(B + p)
      await d.locator('.m-page').first().waitFor()
      driverText += await d.locator('.mobile-frame').innerText()
    }
    check('D4 No household counts on Driver screens', !/household/i.test(driverText))
    await d.screenshot({ path: join(OUT, 'driver-profile.png'), fullPage: true })
    await a.screenshot({ path: join(OUT, 'admin-crew.png'), fullPage: true })
    await nav('Dashboard', 'Barangay Waste Management')
    await a.locator('.admin-topbar a.admin-avatar--link').click()
    check('PR1 Top-right initials open Settings', await a.waitForURL('**/admin/settings').then(() => true).catch(() => false))
    await nav('Dashboard', 'Barangay Waste Management')
    await a.locator('a.admin-profile').click()
    check('PR2 Sidebar profile opens Settings', await a.waitForURL('**/admin/settings').then(() => true).catch(() => false))
    await a.locator('.settings-account input[type=file]').setInputFiles(PICTURE)
    await a.getByText('Profile picture saved').waitFor({ timeout: 8000 }).catch(() => {})
    check('PR2b Admin picture shows top-right and bottom-left', /^upl:/.test((await serverState()).adminPhoto ?? '') && (await loaded(a.locator('.admin-topbar img'))) && (await loaded(a.locator('.admin-profile img'))))
    await a.reload()
    await a.locator('.admin-page h1').waitFor()
    check('PR2c Admin picture still there after refresh', await loaded(a.locator('.admin-topbar img')))
    const fits = []
    for (const w of [1366, 820, 390]) {
      await a.setViewportSize({ width: w, height: 900 })
      await a.waitForTimeout(200)
      const ok = await a.evaluate(() => {
        const card = document.querySelector('.settings-section').getBoundingClientRect()
        const body = document.querySelector('.settings-account')
        const pad = parseFloat(getComputedStyle(body).paddingLeft)
        return pad >= 12 && [...body.querySelectorAll('button, dd')].every((el) => {
          const r = el.getBoundingClientRect()
          return r.left >= card.left + 8 && r.right <= card.right - 8
        })
      })
      if (!ok) fits.push(w)
    }
    await a.setViewportSize({ width: 390, height: 900 })
    await a.locator('.settings-section').first().screenshot({ path: join(OUT, 'admin-myaccount-phone.png') })
    await a.setViewportSize({ width: 1366, height: 900 })
    check('PR3 My Account fits inside its card (1366 / 820 / 390 px)', fits.length === 0, fits.join(', '))
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

  await step('Holiday / suspension and the resident calendar', async () => {
    // Next collection day after today (Mon/Wed/Fri).
    const next = new Date()
    do next.setDate(next.getDate() + 1)
    while (![1, 3, 5].includes(next.getDay()))
    const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
    await nav('Routes & Schedules')
    await a.fill('#ex-date', iso)
    await a.selectOption('#ex-kind', 'holiday')
    await a.fill('#ex-reason', 'Test holiday')
    await a.getByRole('button', { name: 'Add', exact: true }).click()
    check('H1 Admin adds a holiday (saved)', (await seen(a.locator('.exceptions-list').getByText('Test holiday'))) && (await serverState()).scheduleExceptions.some((x) => x.date === iso))
    await r.goto(`${B}/resident/schedule`)
    await r.locator('.res-cal').waitFor()
    if (next.getMonth() !== new Date().getMonth()) await r.getByRole('button', { name: 'Next month' }).click()
    const cell = r.locator('.res-cal__day', { has: r.locator(`text="${next.getDate()}"`) }).first()
    check('H2 Calendar: exclamation icon on the holiday (not the truck)', (await cell.getAttribute('class')).includes('is-holiday'))
    check('H3 Calendar: X today for "could not dispose" (Maria)', (await r.goto(`${B}/resident/schedule`)) && (await seen(r.locator('.res-cal__day.is-today.is-missed'))))
    const legend = await r.locator('.res-cal__legend').innerText()
    check('H4 Legend explains all five icons', ['Pickup day', 'disposed', 'skipped', 'Not completed', 'Holiday'].every((t) => legend.includes(t)))
    await r.locator('.res-cal').screenshot({ path: join(OUT, 'resident-calendar.png') })
    check('H5 Residents told about the holiday', await seen(r.locator('a[aria-label^="Notifications"], .mobile-bell').first()) && (await serverState()).notifications.some((x) => x.key === `exception-${iso}`))
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
    await n.goto(`${B}/resident/profile`)
    await n.locator('input[type=file]').setInputFiles(PICTURE)
    await n.getByText('Profile picture saved').waitFor({ timeout: 8000 }).catch(() => {})
    const pedroPhoto = (await serverState()).residents.find((x) => x.name === 'Pedro Santos')?.photo
    check('S3 Resident picture saved and shown', /^upl:/.test(pedroPhoto ?? '') && (await loaded(n.locator('.ct-avatar-picker img'))) && (await serverState()).residents.find((x) => x.name !== 'Pedro Santos' && x.photo === pedroPhoto) === undefined)
    await n.goto(`${B}/resident`)
    check('S4 Picture on Resident Home', await loaded(n.locator('.m-card').first().locator('img')))
    // A new resident: NO -> friendly joke; change -> YES, YES, YES -> confetti once.
    const fb = n.locator('.res-feedback')
    await fb.getByRole('button', { name: 'NO' }).click()
    check('R1 "Not today": friendly reply, check closes (no confetti)', (await seen(fb.locator('.res-reply.is-fun'))) && (await n.locator('.res-feedback.is-closed').count()) === 1 && (await n.locator('.ct-celebrate').count()) === 0)
    await n.goto(`${B}/resident/schedule`)
    check('R1b Calendar: skip icon today', await seen(n.locator('.res-cal__day.is-today.is-skipped')))
    await n.goto(`${B}/resident`)
    await fb.getByRole('button', { name: /View/ }).click()
    await fb.getByRole('button', { name: /Change my answers/ }).click()
    await fb.getByRole('button', { name: 'YES' }).click()
    await fb.getByText('Did the garbage truck pass your location?').waitFor()
    await fb.getByRole('button', { name: 'YES' }).click()
    await fb.getByText('Were you able to dispose of your garbage?').waitFor()
    check('R2 No celebration for intending / truck passing', (await n.locator('.ct-celebrate').count()) === 0)
    const yes = fb.getByRole('button', { name: 'YES' })
    // A failed save keeps the check open with an error, and saves nothing.
    await n.route('**/api/actions', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server unavailable (test)' }) }), { times: 1 })
    await yes.click()
    check('R2b Failed save: error shown, check stays open', (await seen(fb.getByRole('alert'))) && (await seen(fb.getByText('Were you able to dispose of your garbage?'))) && (await serverState()).collectionFeedback.find((f) => f.residentName === 'Pedro Santos')?.disposed === null)
    await n.unroute('**/api/actions')
    await yes.click()
    await yes.click({ timeout: 300 }).catch(() => {}) // double tap
    check('R3 Disposed: confetti + cheerful message', (await seen(n.locator('.ct-celebrate'))) && (await seen(fb.locator('.res-reply.is-win'))))
    await n.screenshot({ path: join(OUT, 'resident-celebration.png') })
    const pedro = (await serverState()).collectionFeedback.filter((f) => f.residentName === 'Pedro Santos')
    check('R4 One saved record, answers separate', pedro.length === 1 && pedro[0].willDispose && pedro[0].truckPassed && pedro[0].disposed === true)
    await n.reload()
    await n.locator('.res-feedback').waitFor()
    await n.waitForTimeout(500)
    check('R5b Completed check stays closed after reload', (await n.locator('.res-feedback.is-closed').count()) === 1)
    await n.goto(`${B}/resident/schedule`)
    await n.locator('.res-cal').waitFor()
    check('R6 Calendar: check icon today; no X on future days', (await seen(n.locator('.res-cal__day.is-today.is-done'))) && (await n.evaluate((today) => [...document.querySelectorAll('.res-cal__day.is-missed')].every((b) => !b.getAttribute('aria-label').includes('(today)') && b.compareDocumentPosition(document.querySelector('.res-cal__day.is-today')) & Node.DOCUMENT_POSITION_FOLLOWING), null)))
    await n.goto(`${B}/resident`)
    await n.locator('.res-feedback').waitFor()
    check('R5 Reload: no confetti replay, no duplicate', (await n.locator('.ct-celebrate').count()) === 0 && (await serverState()).collectionFeedback.filter((f) => f.residentName === 'Pedro Santos').length === 1)
    await n.close()
  })

  await step('No barangay name on screens', async () => {
    const hits = []
    const pages = [[a, '/admin'], [a, '/admin/live-tracking'], [a, '/admin/truck'], [a, '/admin/collectors'], [a, '/admin/routes'], [a, '/admin/collection'], [a, '/admin/resident-reports'], [a, '/admin/notifications'], [a, '/admin/analytics'], [a, '/admin/settings'], [r, '/resident'], [r, '/resident/track'], [r, '/resident/schedule'], [r, '/resident/reports'], [r, '/resident/reports/new'], [r, '/resident/notifications'], [r, '/resident/profile'], [d, '/driver'], [d, '/driver/route'], [d, '/driver/report'], [d, '/driver/profile']]
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
    for (const p of ['/admin', '/admin/live-tracking', '/admin/routes', '/admin/collection', '/admin/collectors', '/admin/analytics', '/admin/settings', '/admin/notifications?tab=email']) {
      await m.goto(B + p)
      await m.locator('.admin-page').first().waitFor()
      await m.waitForTimeout(300)
      if (!(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))) wide.push(p)
    }
    check('Phone: admin screens do not scroll sideways', wide.length === 0, wide.join(', '))
    const hits = []
    for (const [pg, p] of [[r, '/resident'], [r, '/resident/schedule'], [r, '/resident/reports/new'], [d, '/driver'], [d, '/driver/route'], [d, '/driver/report']]) {
      await pg.goto(B + p)
      await pg.locator('.m-page').first().waitFor()
      const t = await pg.locator('.mobile-frame').innerText()
      const hit = t.match(/green bin|blue bin|\bbins?\b/i)
      if (hit) hits.push(`${p}: ${hit[0]}`)
    }
    check('No bin wording on Resident/Driver screens', hits.length === 0, hits.join('; '))
    const sorting = []
    for (const p of ['/resident', '/resident/schedule', '/resident/reports/new']) {
      await r.goto(B + p)
      await r.locator('.m-page').first().waitFor()
      const hit = (await r.locator('.mobile-frame').innerText()).match(/Food & garden|Recyclables|Batteries|How to separate|RA 9003|Other trash/i)
      if (hit) sorting.push(`${p}: ${hit[0]}`)
    }
    check('No waste-sorting categories on Resident screens', sorting.length === 0, sorting.join('; '))
    await r.goto(`${B}/resident/schedule`)
    await r.locator('.res-cal').waitFor()
    const sched = await r.locator('.mobile-frame').innerText()
    check('Resident schedule: Monday, Wednesday and Friday', sched.includes('Monday, Wednesday and Friday'))
    // Admin login layout (signed-out window).
    const lp = watch(await browser.newPage({ viewport: { width: 1366, height: 768 } }))
    await lp.goto(`${B}/admin/login`)
    await lp.locator('#admin-email').waitFor()
    const wide2 = await lp.evaluate(() => {
      const h = document.querySelector('.admin-login__hero').getBoundingClientRect()
      const f = document.querySelector('.admin-login__panel').getBoundingClientRect()
      return h.right <= f.left + 1 && h.width > 500 && document.documentElement.scrollHeight <= window.innerHeight + 1
    })
    await lp.screenshot({ path: join(OUT, 'admin-login.png') })
    await lp.setViewportSize({ width: 390, height: 844 })
    await lp.waitForTimeout(200)
    const narrow = await lp.evaluate(() => {
      const h = document.querySelector('.admin-login__hero').getBoundingClientRect()
      const f = document.querySelector('.admin-login__card').getBoundingClientRect()
      return h.bottom <= f.top + 1 && document.documentElement.scrollWidth <= window.innerWidth && f.left >= 0 && f.right <= window.innerWidth
    })
    await lp.screenshot({ path: join(OUT, 'admin-login-phone.png'), fullPage: true })
    check('Admin login: two columns fill the window (no scroll); stacks on phones', wide2 && narrow)
    await lp.fill('#admin-email', 'admin@cleantrack.gov')
    await lp.fill('#admin-password', 'SuperAdmin#2025')
    await lp.getByRole('button', { name: 'Sign In', exact: true }).click()
    check('Admin login still signs in', await lp.waitForURL(/\/admin$/).then(() => true).catch(() => false))
    await lp.close()
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
