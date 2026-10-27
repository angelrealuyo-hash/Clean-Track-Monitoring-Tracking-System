import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, House, Lock, Mail, MapPin, Phone, ShieldCheck, User, UserPlus } from 'lucide-react'
import MobileFrame from '../../components/MobileFrame.jsx'
import Logo from '../../components/Logo.jsx'
import Field from '../../components/Field.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useAuth } from '../../auth/authContext.js'
import { barangay } from '../../data/barangay.js'
import { isEmail, normalizePhone, passwordStrength } from '../../utils/validate.js'
import '../../styles/mobile-auth.css'
import './CreateAccountPage.css'

const strengthText = ['Too weak', 'Weak', 'Fair', 'Strong']

// PDF page 35
export default function CreateAccountPage() {
  const { register } = useAuth()
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    purok: barangay.puroks[0],
    password: '',
  })
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const strength = passwordStrength(form.password)

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    const errs = {}
    if (form.name.trim().split(/\s+/).length < 2) errs.name = 'Enter your first and last name.'
    // Email is optional; the mobile number is enough to sign in.
    const email = form.email.trim().toLowerCase()
    if (email && !isEmail(email)) errs.email = 'Check the email, or leave it empty.'
    if (!normalizePhone(form.phone)) errs.phone = 'Enter a PH mobile number, e.g. 917 555 0192.'
    if (form.street.trim().length < 3) errs.street = 'Enter your house number and street.'
    if (form.password.length < 6) errs.password = 'Use at least 6 characters.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    // The server checks again (including duplicate numbers/emails) and signs you in.
    setBusy(true)
    const res = await register({ name: form.name, phone: form.phone, email, street: form.street, purok: form.purok, password: form.password })
    setBusy(false)
    if (!res.ok) {
      const field = /number/i.test(res.error) ? 'phone' : /email/i.test(res.error) ? 'email' : 'form'
      setErrors({ [field]: res.error })
      return
    }
    navigate('/resident', { replace: true })
  }


  return (
    <MobileFrame>
      <div className="m-auth">
        <div className="m-auth__top">
          <Link to="/resident/login" className="ct-icon-btn" aria-label="Back to sign in">
            <ArrowLeft size={18} />
          </Link>
          <Logo variant="resident" size={28} />
          <strong>CleanTrack</strong>
          <StatusBadge tone="green">Resident</StatusBadge>
        </div>

        <span className="m-auth__pill">
          <StatusBadge tone="green">
            <ShieldCheck size={12} /> New account
          </StatusBadge>
        </span>
        <h1 className="m-h1">Create Account</h1>
        <p className="m-muted signup-intro">
          Only 5 quick details. Your mobile number is your sign-in.
        </p>

        <form onSubmit={submit} noValidate>
          <Field label="Full name" htmlFor="su-name" required error={errors.name}>
            <div className="ct-input-group">
              <User size={16} />
              <input id="su-name" autoComplete="name" placeholder="Maria Clara Santos" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
            </div>
          </Field>
          <Field label="Mobile number" htmlFor="su-phone" required error={errors.phone}>
            <div className="ct-input-group">
              <span className="signup-prefix">PH +63</span>
              <Phone size={16} />
              <input id="su-phone" type="tel" autoComplete="tel-national" placeholder="917 555 0192" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
            </div>
          </Field>
          <Field label="House number and street" htmlFor="su-street" required error={errors.street}>
            <div className="ct-input-group">
              <House size={16} />
              <input id="su-street" autoComplete="street-address" placeholder="e.g. Lot 5, your street" value={form.street} onChange={set('street')} aria-invalid={!!errors.street} />
            </div>
          </Field>
          <Field label="Area (Purok)" htmlFor="su-purok" hint="We use this to tell you when the truck is near.">
            <div className="ct-input-group">
              <MapPin size={16} />
              <select id="su-purok" className="signup-select" value={form.purok} onChange={set('purok')}>
                {barangay.puroks.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Password" htmlFor="su-pw" required error={errors.password} hint="At least 6 characters.">
            <div className="ct-input-group">
              <Lock size={16} />
              <input id="su-pw" type={show ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={set('password')} aria-invalid={!!errors.password} />
              <button type="button" className="ct-icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide passwords' : 'Show passwords'}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div className={`signup-strength is-${strength}`} aria-live="polite">
                <span />
                <span />
                <span />
                <small>Strength: {strengthText[strength]}</small>
              </div>
            )}
          </Field>
          <Field label="Email (optional)" htmlFor="su-email" error={errors.email}>
            <div className="ct-input-group">
              <Mail size={16} />
              <input id="su-email" type="email" autoComplete="email" placeholder="you@email.com" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
            </div>
          </Field>

          {errors.form && (
            <div className="ct-alert ct-alert--error" role="alert">
              {errors.form}
            </div>
          )}
          <button type="submit" className="ct-btn ct-btn--primary ct-btn--block signup-submit" disabled={busy}>
            <UserPlus size={16} /> Create Account
          </button>
        </form>

        <p className="m-auth__switch">
          Already registered? <Link to="/resident/login">Sign In ›</Link>
        </p>
        <footer className="m-auth__footer">Your details are only used by the barangay for garbage collection.</footer>
      </div>
    </MobileFrame>
  )
}
