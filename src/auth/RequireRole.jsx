import { Navigate, useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useIsSignedIn } from './useAccount.js'
import { useAuth } from './authContext.js'
import { useData } from '../store/dataContext.js'
import PageLoader from '../components/PageLoader.jsx'

// Sends people to the right login page if they are not signed in to this app,
// and waits for their data from the server before showing the app.
export default function RequireRole({ role, children }) {
  const signedIn = useIsSignedIn(role)
  const { signedOut } = useAuth()
  const { status, error, reload } = useData()
  const location = useLocation()

  if (!signedIn) {
    // Remember the page only when the visitor was not signed in yet (e.g. a
    // bookmark). After a deliberate Sign Out, the next sign-in starts at home.
    const state = signedOut[role] ? undefined : { from: location.pathname }
    return <Navigate to={`/${role}/login`} replace state={state} />
  }
  if (status === 'error') {
    return (
      <div className="ct-empty" role="alert" style={{ padding: '48px 16px' }}>
        <p>
          <strong>Could not load CleanTrack.</strong>
          <br />
          {error}
        </p>
        <button type="button" className="ct-btn ct-btn--primary" onClick={reload}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    )
  }
  if (status !== 'ready') return <PageLoader />
  return children
}
