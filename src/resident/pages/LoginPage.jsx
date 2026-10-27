import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, Bell, Eye, EyeOff, Info, Lock, User, Zap } from 'lucide-react'
import MobileFrame from '../../components/MobileFrame.jsx'
import Logo from '../../components/Logo.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useAuth } from '../../auth/authContext.js'
import { useIsSignedIn } from '../../auth/useAccount.js'
import { demoUsers } from '../../data/users.js'
import { barangay } from '../../data/barangay.js'
import '../../styles/mobile-auth.css'

const nameParts = demoUsers.resident.name.split(' ')
const shortName = `${nameParts[0]} ${nameParts.at(-1)}`

// PDF page 34
export default function LoginPage() {
  const { login } = useAuth()
  const signedIn = useIsSignedIn('resident')
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [busy, setBusy] = useState(false)

  // Once signed in, go to the page they originally asked for (or the app's home).
  if (signedIn) return <Navigate to={location.state?.from || '/resident'} replace />

  async function signIn(emailValue, passwordValue) {
    if (busy) return
    setBusy(true)
    const res = await login('resident', emailValue, passwordValue, remember)
    setBusy(false)
    // On success, the redirect at the top of this component takes over.
    if (!res.ok) setError(res.error || 'Wrong email or password.')
  }


  return (
    <MobileFrame>
      <div className="m-auth">
        <div className="m-auth__top">
          <Logo variant="resident" size={28} />
          <strong>CleanTrack Resident</strong>
          <Bell size={18} color="var(--ct-text-muted)" aria-hidden="true" />
        </div>

        <span className="m-auth__pill">
          <StatusBadge tone="green">Demo app</StatusBadge>
        </span>

        <div className="m-auth__card m-auth__hero">
          <Logo size={44} />
          <div>
            <strong>CleanTrack</strong>
            <p>For barangay residents</p>
          </div>
        </div>

        <form
          className="m-auth__card"
          onSubmit={(e) => {
            e.preventDefault()
            signIn(email, password)
          }}
        >
          <h2>Resident Sign In</h2>
          <p>See where the garbage truck is and tell the Barangay about problems.</p>

          {error && (
            <div className="ct-alert ct-alert--error" role="alert">
              {error}
            </div>
          )}

          <div className="ct-field">
            <label className="ct-label" htmlFor="res-email">
              Email or mobile number
            </label>
            <div className="ct-input-group">
              <User size={16} />
              <input
                id="res-email"
                type="text"
                autoComplete="username"
                placeholder="you@email.com or 0917 555 0192"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="ct-field">
            <label className="ct-label" htmlFor="res-password">
              Password
            </label>
            <div className="ct-input-group">
              <Lock size={16} />
              <input
                id="res-password"
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

          <div className="m-auth__options">
            <label className="ct-checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember Me
            </label>
            <button type="button" className="ct-link-btn" onClick={() => setShowForgot((v) => !v)}>
              Forgot Password?
            </button>
          </div>

          {showForgot && (
            <div className="ct-alert">
              <Info size={16} />
              <span>
                Please visit or call the Barangay Office at <strong>{barangay.hotline}</strong> to reset
                your password.
              </span>
            </div>
          )}

          <button type="submit" className="ct-btn ct-btn--primary ct-btn--block" disabled={busy}>
            Sign In as Resident <ArrowRight size={16} />
          </button>

          <div className="ct-divider-text">OR</div>

          <button
            type="button"
            className="m-auth__quick"
            onClick={() => signIn(demoUsers.resident.email, demoUsers.resident.password)}
          >
            <Zap size={18} color="var(--ct-amber-500)" />
            <span>
              Try the demo as {shortName}
              <small>{demoUsers.resident.purok}</small>
            </span>
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="m-auth__switch">
          Don&apos;t have an account? <Link to="/resident/register">Create an account</Link>
        </p>

        <footer className="m-auth__footer">
          <strong>Need help? Call {barangay.hotline}</strong>
          Barangay garbage office
        </footer>
      </div>
    </MobileFrame>
  )
}
