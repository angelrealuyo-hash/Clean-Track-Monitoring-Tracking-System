import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './authContext.js'

// Sends people to the right login page if they are not signed in to this app.
export default function RequireRole({ role, children }) {
  const { sessions } = useAuth()
  const location = useLocation()

  if (!sessions[role]) {
    return <Navigate to={`/${role}/login`} replace state={{ from: location.pathname }} />
  }
  return children
}
