// Production server: serves the built app (dist/) and the API on one port.
//   npm run build && npm start
import express from 'express'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from './app.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const port = Number(process.env.PORT || 3000)

const app = express()
const api = createApi({ tickMs: Number(process.env.CLEANTRACK_TICK_MS) || 15_000 })
app.use('/api', api.router)
if (existsSync(dist)) {
  app.use(express.static(dist))
  // Let React Router handle every other page.
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(dist, 'index.html')))
} else {
  console.warn('dist/ not found: run "npm run build" first to serve the app.')
}
app.listen(port, () => console.log(`CleanTrack running on http://localhost:${port}`))
