import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

// { sessions, login, logout } — see AuthProvider.jsx
export function useAuth() {
  return useContext(AuthContext)
}
