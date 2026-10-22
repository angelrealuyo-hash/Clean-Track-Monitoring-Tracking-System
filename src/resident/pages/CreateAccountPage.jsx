import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, House, Lock, Mail, MapPin, Phone, ShieldCheck, User, UserPlus } from 'lucide-react'
import MobileFrame from '../../components/MobileFrame.jsx'
import Logo from '../../components/Logo.jsx'
import Field from '../../components/Field.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useAuth } from '../../auth/authContext.js'
import { nextId } from '../../store/dataReducer.js'
import { barangay } from '../../data/barangay.js'
import { isEmail, normalizePhone, passwordStrength } from '../../utils/validate.js'
import '../../styles/mobile-auth.css'
import './CreateAccountPage.css'

const strengthText = ['Too weak', 'Weak', 'Fair', 'Strong']

// PDF page 35
export default function CreateAccountPage() {
  const { data, dispatch } = useData()
  const { loginAs } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    purok: barangay.puroks[0],
    password: '',
    confirm: '',
    agree: false,
  })
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const strength = passwordStrength(form.password)

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().split(/\s+/).length < 2) errs.name = 'Enter your first and last name.'
    if (!isEmail(form.email)) errs.email = 'Enter a valid email address.'
    else if (data.residents.some((r) => r.email.toLowerCase() === form.email.trim().toLowerCase())) {
      errs.email = 'An account with this email already exists. Sign in instead.'
    }
    const phone = normalizePhone(form.phone)
    if (!phone) errs.phone = 'Enter a PH mobile number, e.g. 917 555 0192.'
    if (form.street.trim().length < 5) errs.street = 'Enter your house number and street.'
    if (form.password.length < 8 || strength < 2) errs.password = 'Use at least 8 characters with letters and numbers.'
    if (form.confirm !== form.password) errs.confirm = 'Passwords do not match.'
    if (!form.agree) errs.agree = 'Please agree to the guidelines to continue.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    const id = nextId('RES', data.residents, 3)
    dispatch({
      type: 'resident/add',
      payload: {
        id,
        name: form.name.trim().replace(/\s+/g, ' '),
        email: form.email.trim().toLowerCase(),
        phone,
        address: `${form.street.trim()}, ${form.purok}`,
        purok: form.purok,
        password: form.password,
      },
    })
    loginAs('resident', id)
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
          <StatusBadge tone="green">{barangay.name}</StatusBadge>
        </div>

        <span className="m-auth__pill">
          <StatusBadge tone="green">
            <ShieldCheck size={12} /> Household Registry
          </StatusBadge>
        </span>
        <h1 className="m-h1">Create Account</h1>
        <p className="m-muted signup-intro">
          Register to receive truck alerts and report collection concerns for your household.
        </p>

        <form onSubmit={submit} noValidate>
          <Field label="Full Name" htmlFor="su-name" required error={errors.name}>
            <div className="ct-input-group">
              <User size={16} />
              <input id="su-name" autoComplete="name" placeholder="Maria Clara Santos" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
            </div>
          </Field>
          <Field label="Email Address" htmlFor="su-email" required error={errors.email}>
            <div className="ct-input-group">
              <Mail size={16} />
              <input id="su-email" type="email" autoComplete="email" placeholder="you@email.com" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
            </div>
          </Field>
          <Field label="Contact Number" htmlFor="su-phone" required error={errors.phone}>
            <div className="ct-input-group">
              <span className="signup-prefix">PH +63</span>
              <Phone size={16} />
              <input id="su-phone" type="tel" autoComplete="tel-national" placeholder="917 555 0192" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
            </div>
          </Field>
          <Field label="House Number / Street / Sitio" htmlFor="su-street" required error={errors.street}>
            <div className="ct-input-group">
              <House size={16} />
              <input id="su-street" autoComplete="street-address" placeholder="Block 4 Lot 12, Narra Street" value={form.street} onChange={set('street')} aria-invalid={!!errors.street} />
            </div>
          </Field>
          <Field label="Purok" htmlFor="su-purok" hint="Used for truck alerts and purok advisories.">
            <div className="ct-input-group">
              <MapPin size={16} />
              <select id="su-purok" className="signup-select" value={form.purok} onChange={set('purok')}>
                {barangay.puroks.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Create Password" htmlFor="su-pw" required error={errors.password}>
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
          <Field label="Confirm Password" htmlFor="su-confirm" required error={errors.confirm}>
            <div className="ct-input-group">
              <Lock size={16} />
              <input id="su-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} aria-invalid={!!errors.confirm} />
            </div>
          </Field>
          <label className="ct-checkbox signup-agree">
            <input type="checkbox" checked={form.agree} onChange={set('agree')} aria-invalid={!!errors.agree} />
            <span>
              I agree to the <strong>Barangay Solid Waste Management guidelines</strong> and to receive collection
              notifications.
            </span>
          </label>
          {errors.agree && <span className="ct-field__error">{errors.agree}</span>}

          <button type="submit" className="ct-btn ct-btn--primary ct-btn--block signup-submit">
            <UserPlus size={16} /> Create Resident Account
          </button>
        </form>

        <p className="m-auth__switch">
          Already registered? <Link to="/resident/login">Sign In ›</Link>
        </p>
        <footer className="m-auth__footer">Demo app: your account is saved in this browser only.</footer>
      </div>
    </MobileFrame>
  )
}
