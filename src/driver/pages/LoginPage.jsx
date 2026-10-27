import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Info, Lock, MapPin, Phone, User, Zap } from 'lucide-react'
import MobileFrame from '../../components/MobileFrame.jsx'
import Logo from '../../components/Logo.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useAuth } from '../../auth/authContext.js'
import { useIsSignedIn } from '../../auth/useAccount.js'
import { demoUsers } from '../../data/users.js'
import { drivers } from '../../data/drivers.js'
import { truck } from '../../data/truck.js'
import { barangay } from '../../data/barangay.js'
import '../../styles/mobile-auth.css'

const demoDriver = drivers.find((d) => d.id === demoUsers.driver.id)

// PDF page 44
export default function LoginPage() {
  const { login } = useAuth()
  const signedIn = useIsSignedIn('driver')
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [busy, setBusy] = useState(false)

  // Once signed in, go to the page they originally asked for (or the app's home).
  if (signedIn) return <Navigate to={location.state?.from || '/driver'} replace />

  async function signIn(emailValue, passwordValue) {
    if (busy) return
    setBusy(true)
    const res = await login('driver', emailValue, passwordValue, remember)
    setBusy(false)
    // On success, the redirect at the top of this component takes over.
    if (!res.ok) setError(res.error || 'Wrong email or password.')
  }


  return (
    <MobileFrame>
      <div className="m-auth">
        <div className="m-auth__top">
          <StatusBadge tone="green">Demo app</StatusBadge>
        </div>

        <div className="m-auth__brand">
          <Logo variant="driver" size={80} />
          <h1>CleanTrack Driver</h1>
          <p>For barangay garbage truck drivers</p>
          <StatusBadge tone="gray">
            <MapPin size={12} /> Barangay garbage office
          </StatusBadge>
        </div>

        <form
          className="m-auth__card"
          onSubmit={(e) => {
            e.preventDefault()
            signIn(email, password)
          }}
        >
          <h2>Driver Sign In</h2>
          <p>Sign in to start your route.</p>

          {error && (
            <div className="ct-alert ct-alert--error" role="alert">
              {error}
            </div>
          )}

          <div className="ct-field">
            <label className="ct-label" htmlFor="drv-email">
              Driver Email
            </label>
            <div className="ct-input-group">
              <User size={16} />
              <input
                id="drv-email"
                type="email"
                autoComplete="username"
                placeholder="driver@cleantrack.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="ct-field">
            <div className="ct-field__row">
              <label className="ct-label" htmlFor="drv-password">
                Password
              </label>
              <button type="button" className="ct-link-btn" onClick={() => setShowForgot((v) => !v)}>
                Forgot Password?
              </button>
            </div>
            <div className="ct-input-group">
              <Lock size={16} />
              <input
                id="drv-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="ct-icon-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {showForgot && (
            <div className="ct-alert">
              <Info size={16} />
              <span>
                Ask the Barangay Office at <strong>{barangay.hotline}</strong> to reset your password.
              </span>
            </div>
          )}

          <label className="ct-checkbox" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember this device
          </label>

          <button type="submit" className="ct-btn ct-btn--primary ct-btn--block" disabled={busy}>
            Sign In to Shift <ArrowRight size={16} />
          </button>

          <div className="ct-divider-text">OR</div>

          <button
            type="button"
            className="m-auth__quick"
            onClick={() => signIn(demoUsers.driver.email, demoUsers.driver.password)}
          >
            <Zap size={18} />
            <span>
              Try the demo as {demoDriver.name}
              <small>
                Truck {truck.id} · morning route
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="ct-alert">
          <Info size={16} />
          <span>
            <strong>Demo app:</strong> the truck location on the map is simulated.
          </span>
        </div>

        <footer className="m-auth__footer">
          Need help? Call the Barangay office
          <strong>
            <Phone size={12} /> {barangay.hotline}
          </strong>
        </footer>
      </div>
    </MobileFrame>
  )
}
