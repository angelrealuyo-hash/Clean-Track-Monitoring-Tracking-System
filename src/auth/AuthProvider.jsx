// Sign-in for the three apps. The SERVER checks passwords and returns a signed
// token; this keeps one session per app (admin, resident, driver), so all
// three can be open at once while testing. Only the token and the user's id
// and name are stored in the browser, never passwords or app data.
import { useCallback, useMemo, useState } from 'react'
import { AuthContext } from './authContext.js'
import { api } from '../api/client.js'

const STORAGE_KEY = 'cleantrack.sessions.v2'

function read(store) {
  try {
    return JSON.parse(store.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function write(store, value) {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage blocked (private mode): the session lasts until the tab closes.
  }
}

export default function AuthProvider({ children }) {
  // "Remember me" sessions live in localStorage; others only for this tab.
  const [sessions, setSessions] = useState(() => ({ ...read(localStorage), ...read(sessionStorage) }))
  // Apps the user signed out of on purpose: their next sign-in opens the app home.
  const [signedOut, setSignedOut] = useState({})

  const start = useCallback((role, { token, user }, remember) => {
    const session = { token, id: user.refId, name: user.name, ...(user.title ? { title: user.title, initials: user.initials } : {}) }
    setSignedOut((s) => ({ ...s, [role]: false }))
    setSessions((s) => ({ ...s, [role]: session }))
    write(sessionStorage, { ...read(sessionStorage), [role]: session })
    if (remember) write(localStorage, { ...read(localStorage), [role]: session })
  }, [])

  // Returns { ok: true } or { ok: false, error }.
  const login = useCallback(
    async (role, identifier, password, remember = false) => {
      try {
        start(role, await api('/auth/login', { body: { role, identifier, password } }), remember)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    },
    [start],
  )

  const register = useCallback(
    async (form) => {
      try {
        start('resident', await api('/auth/register', { body: form }), true)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err.message, status: err.status }
      }
    },
    [start],
  )

  // reason: 'manual' (Sign Out button) or 'expired' (server said sign in again).
  const logout = useCallback((role, reason = 'manual') => {
    if (reason === 'manual') setSignedOut((s) => ({ ...s, [role]: true }))
    setSessions((s) => {
      const next = { ...s }
      delete next[role]
      return next
    })
    for (const store of [sessionStorage, localStorage]) {
      const saved = read(store)
      delete saved[role]
      write(store, saved)
    }
  }, [])

  const value = useMemo(() => ({ sessions, signedOut, login, register, logout }), [sessions, signedOut, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
