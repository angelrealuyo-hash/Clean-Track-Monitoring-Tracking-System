import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  CircleCheck,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  RotateCcw,
  Send,
  User,
} from 'lucide-react'
import Logo from '../../components/Logo.jsx'
import Modal from '../../components/Modal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useAuth } from '../../auth/authContext.js'
import { demoUsers } from '../../data/users.js'
import { barangay } from '../../data/barangay.js'
import './LoginPage.css'

// PDF pages 1-2
export default function LoginPage() {
  const { sessions, login } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [autoFilled, setAutoFilled] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // Once signed in, go to the page they originally asked for (or the app's home).
  if (sessions.admin) return <Navigate to={location.state?.from || '/admin'} replace />

  function autoFill() {
    setEmail(demoUsers.admin.email)
    setPassword(demoUsers.admin.password)
    setError('')
    setAutoFilled(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    // On success, the redirect at the top of this component takes over.
    if (!login('admin', email, password, remember)) {
      setAutoFilled(false)
      setError('Incorrect email or password. Use Auto Fill to load the demo account.')
    }
  }

  function closeForgot() {
    setForgotOpen(false)
    setResetSent(false)
  }

  return (
    <div className="admin-login">
      <header className="admin-login__bar">
        <Logo size={26} />
        <strong>CleanTrack</strong>
        <span className="admin-login__bar-sep">/</span>
        <span>{barangay.name} Solid Waste Office</span>
        <div className="admin-login__bar-right">
          <StatusBadge tone="green">Simulated Demo Mode</StatusBadge>
        </div>
      </header>

      <main className="admin-login__body">
        <form className="admin-login__card" onSubmit={handleSubmit}>
          <div className="admin-login__brand">
            <Logo size={52} />
            <h1>CleanTrack</h1>
            <p>Barangay Waste Management Portal</p>
          </div>

          {autoFilled && (
            <div className="ct-alert">
              <CircleCheck size={16} />
              <span>Demo credentials loaded. Click &quot;Sign In&quot; to continue.</span>
            </div>
          )}
          {error && (
            <div className="ct-alert ct-alert--error" role="alert">
              {error}
            </div>
          )}

          <div className="ct-alert admin-login__demo">
            <KeyRound size={16} />
            <span>
              <strong>Demo Mode:</strong> click to auto-fill credentials
            </span>
            <button type="button" className="ct-link-btn" onClick={autoFill}>
              Auto Fill
            </button>
          </div>

          <div className="ct-field">
            <label className="ct-label" htmlFor="admin-email">
              Username or Email
            </label>
            <div className="ct-input-group">
              <User size={16} />
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="admin@cleantrack.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="ct-field">
            <div className="ct-field__row">
              <label className="ct-label" htmlFor="admin-password">
                Password
              </label>
              <button
                type="button"
                className="ct-link-btn"
                onClick={() => {
                  setResetEmail(email)
                  setForgotOpen(true)
                }}
              >
                Forgot Password?
              </button>
            </div>
            <div className="ct-input-group">
              <Lock size={16} />
              <input
                id="admin-password"
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

          <label className="ct-checkbox admin-login__remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember this computer
          </label>

          <button type="submit" className="ct-btn ct-btn--primary ct-btn--block">
            <LogIn size={16} />
            Sign In
          </button>

          <p className="admin-login__help">
            Need assistance? Call the Barangay Office at <strong>{barangay.hotline}</strong>
          </p>
        </form>
      </main>

      <footer className="admin-login__footer">
        <span>© 2025 CleanTrack · {barangay.name}</span>
        <span>Student project prototype · All truck locations are simulated</span>
      </footer>

      {forgotOpen && (
        <Modal
          title="Password Recovery"
          icon={RotateCcw}
          onClose={closeForgot}
          footer={
            resetSent ? (
              <button type="button" className="ct-btn ct-btn--primary" onClick={closeForgot}>
                Done
              </button>
            ) : (
              <>
                <button type="button" className="ct-btn ct-btn--secondary" onClick={closeForgot}>
                  Cancel
                </button>
                <button
                  type="submit"
                  form="forgot-form"
                  className="ct-btn ct-btn--primary"
                >
                  <Send size={15} />
                  Send Reset Link
                </button>
              </>
            )
          }
        >
          {resetSent ? (
            <div className="ct-alert">
              <CircleCheck size={16} />
              <span>
                Demo only: no email was sent. In a real system a reset link would go to{' '}
                <strong>{resetEmail}</strong>.
              </span>
            </div>
          ) : (
            <form
              id="forgot-form"
              onSubmit={(e) => {
                e.preventDefault()
                setResetSent(true)
              }}
            >
              <p>Enter your registered barangay email to request a password reset.</p>
              <div className="ct-field">
                <label className="ct-label" htmlFor="reset-email">
                  Official Email
                </label>
                <input
                  id="reset-email"
                  className="ct-input"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
              <div className="ct-alert">
                <span>
                  <strong>Barangay Office Support</strong>
                  <br />
                  Hotline: {barangay.hotline}
                </span>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}
