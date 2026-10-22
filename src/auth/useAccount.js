import { useAuth } from './authContext.js'
import { useData } from '../store/dataContext.js'

// The signed-in resident's current record from the store (or null).
export function useResident() {
  const { sessions } = useAuth()
  const { data } = useData()
  const id = sessions.resident?.id
  return data.residents.find((r) => r.id === id) ?? null
}

// The signed-in driver's current record from the store (or null).
export function useDriver() {
  const { sessions } = useAuth()
  const { data } = useData()
  const id = sessions.driver?.id
  return data.drivers.find((d) => d.id === id) ?? null
}

// True only when there is a session AND its account still exists (it may have
// been removed by Reset Demo Data or by deleting a driver). Login pages and
// RequireRole both use this, so they can never bounce back and forth.
export function useIsSignedIn(role) {
  const { sessions } = useAuth()
  const { data } = useData()
  const id = sessions[role]?.id
  if (!id) return false
  if (role === 'resident') return data.residents.some((r) => r.id === id)
  if (role === 'driver') return data.drivers.some((d) => d.id === id)
  return true
}
