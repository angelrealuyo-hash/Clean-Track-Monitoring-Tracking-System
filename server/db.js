// Opens the SQLite database (Node's built-in node:sqlite, no extra install) and
// applies any migration in server/migrations that has not run yet. Existing
// data is never deleted.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const DEFAULT_DB_PATH = join(here, 'data', 'cleantrack.db')

export function openDatabase(path = process.env.DB_PATH || DEFAULT_DB_PATH) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
  migrate(db)
  return db
}

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)')
  const done = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name))
  const dir = join(here, 'migrations')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    db.exec('BEGIN')
    try {
      db.exec(readFileSync(join(dir, file), 'utf8'))
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}

// Runs fn inside a transaction. Savepoints make it safe to nest (an inner
// call is undone together with the outer one).
let depth = 0
export function transaction(db, fn) {
  const name = `sp${depth++}`
  db.exec(`SAVEPOINT ${name}`)
  try {
    const result = fn()
    db.exec(`RELEASE ${name}`)
    return result
  } catch (err) {
    db.exec(`ROLLBACK TO ${name}`)
    db.exec(`RELEASE ${name}`)
    throw err
  } finally {
    depth--
  }
}
