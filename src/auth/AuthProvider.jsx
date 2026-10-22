// Demo-only sign-in. There is no backend: admin and driver accounts come from
// data/users.js, resident accounts from the data store (so "Create Account"
// works). Each app (admin, resident, driver) has its own session, so you can be
// signed in to all three at once while testing.
import { useCallback, useMemo, useState } from 'react'
import { AuthContext } from './authContext.js'
import { demoUsers } from '../data/users.js'
import { useData } from '../store/dataContext.js'

const STORAGE_KEY = 'cleantrack.sessions'

function read(store) {
  try {
    return JSON.parse(store.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function write(store, data) {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage can be blocked (private mode); the session then lasts until refresh.
  }
}

const sameEmail = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

export default function AuthProvider({ children }) {
  const { data } = useData()
  // "Remember me" sessions live in localStorage; others only for this tab.
  const [sessions, setSessions] = useState(() => ({
    ...read(localStorage),
    ...read(sessionStorage),
  }))

  // Apps the user signed out of on purpose. Their login page then opens the
  // app's home after the next sign-in, not the page they were on.
  const [signedOut, setSignedOut] = useState({})

  const start = useCallback((role, session, remember) => {
    setSignedOut((s) => ({ ...s, [role]: false }))
    setSessions((s) => ({ ...s, [role]: session }))
    write(sessionStorage, { ...read(sessionStorage), [role]: session })
    if (remember) write(localStorage, { ...read(localStorage), [role]: session })
  }, [])

  // Returns true when the email/password match an account for that app.
  const login = useCallback(
    (role, email, password, remember = false) => {
      let session = null
      if (role === 'resident') {
        const r = data.residents.find((x) => sameEmail(x.email, email) && x.password === password)
        if (r) session = { id: r.id }
      } else {
        const u = demoUsers[role]
        if (u && sameEmail(u.email, email) && u.password === password) {
          session = role === 'driver' ? { id: u.id } : { id: 'ADMIN', name: u.name, title: u.title, initials: u.initials }
        }
      }
      if (!session) return false
      start(role, session, remember)
      return true
    },
    [data.residents, start],
  )

  // Signs in an account that was just created (Create Account).
  const loginAs = useCallback((role, id, remember = true) => start(role, { id }, remember), [start])

  const logout = useCallback((role) => {
    setSignedOut((s) => ({ ...s, [role]: true }))
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

  const value = useMemo(
    () => ({ sessions, signedOut, login, loginAs, logout }),
    [sessions, signedOut, login, loginAs, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
