import { Navigate, useLocation } from 'react-router-dom'
import { useIsSignedIn } from './useAccount.js'
import { useAuth } from './authContext.js'

// Sends people to the right login page if they are not signed in to this app.
export default function RequireRole({ role, children }) {
  const signedIn = useIsSignedIn(role)
  const { signedOut } = useAuth()
  const location = useLocation()

  if (!signedIn) {
    // Remember the page only when the visitor was not signed in yet (e.g. a
    // bookmark). After a deliberate Sign Out, the next sign-in starts at home.
    const state = signedOut[role] ? undefined : { from: location.pathname }
    return <Navigate to={`/${role}/login`} replace state={state} />
  }
  return children
}
