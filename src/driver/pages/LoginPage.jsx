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

  // Once signed in, go to the page they originally asked for (or the app's home).
  if (signedIn) return <Navigate to={location.state?.from || '/driver'} replace />

  function signIn(emailValue, passwordValue) {
    // On success, the redirect at the top of this component takes over.
    if (!login('driver', emailValue, passwordValue, remember)) {
      setError('Incorrect email or password. Try the Quick Demo button below.')
    }
  }

  return (
    <MobileFrame>
      <div className="m-auth">
        <div className="m-auth__top">
          <StatusBadge tone="green">Student Project Prototype · Simulated Demo</StatusBadge>
        </div>

        <div className="m-auth__brand">
          <Logo variant="driver" size={52} />
          <h1>CleanTrack Driver</h1>
          <p>{barangay.name} · Driver App</p>
          <StatusBadge tone="gray">
            <MapPin size={12} /> Solid Waste Management Unit
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
          <p>Sign in to start your collection shift.</p>

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

          <button type="submit" className="ct-btn ct-btn--primary ct-btn--block">
            Sign In to Shift <ArrowRight size={16} />
          </button>

          <div className="ct-divider-text">OR TRY THE DEMO</div>

          <button
            type="button"
            className="m-auth__quick"
            onClick={() => signIn(demoUsers.driver.email, demoUsers.driver.password)}
          >
            <Zap size={18} />
            <span>
              Quick Demo: Sign in as {demoDriver.name}
              <small>
                {truck.type} {truck.id} · Morning Route
              </small>
            </span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="ct-alert">
          <Info size={16} />
          <span>
            <strong>Shift Notice:</strong> Truck location in this prototype is simulated. No GPS
            device is connected.
          </span>
        </div>

        <footer className="m-auth__footer">
          Need help? Contact the Barangay Office
          <strong>
            <Phone size={12} /> {barangay.hotline}
          </strong>
        </footer>
      </div>
    </MobileFrame>
  )
}
