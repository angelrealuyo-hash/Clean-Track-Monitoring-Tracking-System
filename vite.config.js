import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development, the CleanTrack API (server/app.js) runs inside the Vite dev
// server at /api, so `npm run dev` starts everything with one command.
function cleanTrackApi() {
  let api
  return {
    name: 'cleantrack-api',
    apply: 'serve',
    async configureServer(server) {
      // Server-only settings (SMTP, secrets) from .env; never exposed to the browser.
      try {
        process.loadEnvFile('.env')
      } catch {
        // No .env file: demo settings.
      }
      const [{ default: express }, { createApi }] = await Promise.all([import('express'), import('./server/app.js')])
      // CLEANTRACK_TICK_MS: how often automatic notifications run (tests use a short value).
      api = createApi({ tickMs: Number(process.env.CLEANTRACK_TICK_MS) || 15_000 })
      const app = express()
      app.use('/api', api.router)
      server.middlewares.use(app)
      server.httpServer?.once('close', () => api.close())
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cleanTrackApi()],
  server: {
    // Do not reload the page when the database file changes.
    watch: { ignored: ['**/server/data/**'] },
  },
})
