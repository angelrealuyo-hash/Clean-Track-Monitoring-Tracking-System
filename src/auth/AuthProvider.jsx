// Demo-only sign-in. There is no backend: credentials are checked against
// data/users.js. Each app (admin, resident, driver) has its own session so
// you can be signed in to all three at once while testing.
import { useState } from 'react'
import { AuthContext } from './authContext.js'
import { demoUsers } from '../data/users.js'
import { drivers } from '../data/drivers.js'

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

// The profile stored in the session (never includes the password).
function profileFor(role) {
  const profile = { ...demoUsers[role] }
  delete profile.password
  if (role === 'driver') {
    return { ...drivers.find((d) => d.id === profile.id), email: profile.email }
  }
  return profile
}

export default function AuthProvider({ children }) {
  // "Remember me" sessions live in localStorage; others only for this tab.
  const [sessions, setSessions] = useState(() => ({
    ...read(localStorage),
    ...read(sessionStorage),
  }))

  function login(role, email, password, remember = false) {
    const user = demoUsers[role]
    const ok =
      user &&
      email.trim().toLowerCase() === user.email.toLowerCase() &&
      password === user.password
    if (!ok) return false

    const profile = profileFor(role)
    setSessions((s) => ({ ...s, [role]: profile }))
    write(sessionStorage, { ...read(sessionStorage), [role]: profile })
    if (remember) write(localStorage, { ...read(localStorage), [role]: profile })
    return true
  }

  function logout(role) {
    setSessions((s) => {
      const next = { ...s }
      delete next[role]
      return next
    })
    for (const store of [sessionStorage, localStorage]) {
      const data = read(store)
      delete data[role]
      write(store, data)
    }
  }

  return (
    <AuthContext.Provider value={{ sessions, login, logout }}>{children}</AuthContext.Provider>
  )
}
