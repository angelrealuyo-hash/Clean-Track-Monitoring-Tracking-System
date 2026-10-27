import { useAuth } from './authContext.js'
import { useData } from '../store/dataContext.js'

// The signed-in resident's current record (or null).
export function useResident() {
  const { sessions } = useAuth()
  const { data } = useData()
  const id = sessions.resident?.id
  return data?.residents?.find((r) => r.id === id) ?? null
}

// The signed-in driver's current record (or null).
export function useDriver() {
  const { sessions } = useAuth()
  const { data } = useData()
  const id = sessions.driver?.id
  return data?.drivers?.find((d) => d.id === id) ?? null
}

// True when this app has a session token. (The server re-checks it on every
// request; an expired or disabled account is signed out automatically.)
export function useIsSignedIn(role) {
  const { sessions } = useAuth()
  return Boolean(sessions[role]?.token)
}
