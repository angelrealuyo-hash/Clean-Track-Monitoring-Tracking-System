import { useState } from 'react'
import { AlertTriangle, Info, Lock, UserPen, UserPlus } from 'lucide-react'
import PasswordToggle from '../../../components/PasswordToggle.jsx'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import AvatarPicker from '../../../components/AvatarPicker.jsx'
import RoleBadge from './RoleBadge.jsx'
import { initials } from '../../../store/dataReducer.js'
import { crewRoles } from '../../../data/crew.js'
import { LIMITS, ROLE_KEYS, ROLES, SHIFTS, SHIFT_KEYS, capacityOf, fullMessage, shiftLabel } from '../../../data/personnel.js'
import './collectors.css'

const PH_MOBILE = /^(639\d{9}|09\d{9})$/
const countLabel = (type, shift) => `${shiftLabel(shift)} ${type === 'driver' ? 'Drivers' : 'Crew'}`

// Add Collector (choose Driver or Crew Member) or Edit Collector.
// `record` is null when adding, otherwise a collector from collectorsOf().
// Full role + shift choices are disabled here; the server checks them again.
// `preset` ({ type, shift }) pre-selects a role and shift when adding from an open place.
export default function CollectorFormModal({ record, preset = null, data, onSave, onClose, saving = false }) {
  const editing = Boolean(record)
  const truck = data.truck
  const rec = record?.rec ?? {}
  // Counts without this person (so their own slot counts as free for them),
  // and with everyone (what the screen shows).
  const free = capacityOf(data, { excludeKey: record?.key ?? null })
  const shown = capacityOf(data)
  const hasRoom = (type, shift) => free.shifts[shift][type] < LIMITS[type]
  const firstOpenShift = (type) => SHIFT_KEYS.find((s) => hasRoom(type, s)) ?? SHIFT_KEYS[0]
  const firstOpenType = ROLE_KEYS.find((t) => SHIFT_KEYS.some((s) => hasRoom(t, s))) ?? 'crew'

  const [form, setForm] = useState(() => {
    const type = record?.type ?? preset?.type ?? firstOpenType
    return {
      type,
      name: rec.name ?? '',
      shift: editing ? (record.shift ?? '') : preset?.shift && hasRoom(type, preset.shift) ? preset.shift : firstOpenShift(type),
      active: editing ? record.active : true,
      phone: rec.phone ?? (type === 'driver' ? '+63 ' : ''),
      position: rec.role ?? crewRoles[0],
      license: rec.license ?? 'Professional Driver (Class 2)',
      email: rec.email ?? '',
      password: '',
      account: rec.account === 'disabled' ? 'disabled' : 'active',
      photo: rec.photo ?? null,
    }
  })
  const [errors, setErrors] = useState({})
  const [showPw, setShowPw] = useState(false)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const { type } = form
  const isDriver = type === 'driver'

  const shiftFull = (s) => form.active && Boolean(s) && !hasRoom(type, s)
  const roleFull = (t) => SHIFT_KEYS.every((s) => !hasRoom(t, s))
  const chosenFull = shiftFull(form.shift)

  function chooseType(t) {
    setForm((f) => ({
      ...f,
      type: t,
      shift: f.active && !hasRoom(t, f.shift) ? firstOpenShift(t) : f.shift,
      phone: t === 'driver' && !f.phone.trim() ? '+63 ' : t === 'crew' && f.phone.trim() === '+63' ? '' : f.phone,
    }))
  }

  function submit(e) {
    e.preventDefault()
    if (saving) return
    const errs = {}
    if (form.name.trim().length < 3) errs.name = 'Enter the full name.'
    const digits = form.phone.replace(/\D/g, '')
    if (isDriver && !PH_MOBILE.test(digits)) errs.phone = 'Use a PH mobile number, e.g. +63 917 555 0142.'
    if (!isDriver && digits && !PH_MOBILE.test(digits)) errs.phone = 'Use a PH mobile number, e.g. 0917 555 0142, or leave it empty.'
    if (!form.shift && !(editing && !record.shift)) errs.shift = 'Choose the Morning or Afternoon shift.'
    if (chosenFull) errs.shift = fullMessage(type, form.shift)
    if (isDriver) {
      if (!form.license.trim()) errs.license = 'License type is required.'
      const email = form.email.trim().toLowerCase()
      if (email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) errs.email = 'Use a plain email like name@example.com.'
      if (form.password && form.password.length < 6) errs.password = 'At least 6 characters.'
      if (form.password && !email) errs.email = 'An email is needed to sign in.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return

    const shift = form.shift || null
    const base = { name: form.name.trim().replace(/\s+/g, ' '), phone: form.phone.trim(), shift, truckId: shift ? truck.id : null }
    const out = isDriver
      ? { ...base, active: form.active, license: form.license.trim(), email: form.email.trim().toLowerCase() }
      : { ...base, status: form.active ? 'active' : 'inactive', role: form.position }
    if (isDriver && form.password) out.password = form.password
    if (isDriver && editing && rec.account !== 'none') out.account = form.account
    // Only send the picture when it changed (new, replaced or removed).
    if (form.photo !== (rec.photo ?? null)) out.photo = form.photo
    onSave(type, out)
  }

  const allFull = form.active && roleFull(type)

  return (
    <Modal
      title={editing ? `Edit ${ROLES[type].label}` : 'Add Collector'}
      subtitle={editing ? `${rec.name} · ${rec.id}` : `Add a Driver or Crew Member to ${truck.id}`}
      icon={editing ? UserPen : UserPlus}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="collector-form" className="ct-btn ct-btn--primary" disabled={saving || chosenFull}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : `Add ${ROLES[type].label}`}
          </button>
        </>
      }
    >
      <form id="collector-form" className="ct-form-grid" onSubmit={submit} noValidate>
        <div className="ct-field is-wide">
          <span className="ct-label">Profile Picture (optional)</span>
          <AvatarPicker value={form.photo} onChange={(photo) => setForm((f) => ({ ...f, photo }))} initials={initials(form.name || '?')} name={form.name} busy={saving} />
        </div>
        <Field label="Full Name" htmlFor="col-name" required error={errors.name} className="is-wide">
          <input id="col-name" className="ct-input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} autoFocus />
        </Field>

        {editing ? (
          <div className="ct-field is-wide">
            <span className="ct-label">Role</span>
            <div>
              <RoleBadge type={type} />
            </div>
          </div>
        ) : (
          <fieldset className="col-choices is-wide" aria-label="Role">
            <legend className="ct-label">Role *</legend>
            {ROLE_KEYS.map((t) => {
              const full = form.active && roleFull(t)
              return (
                <label key={t} className={`col-choice col-choice--${t}`}>
                  <input type="radio" name="col-role" value={t} checked={type === t} disabled={full} onChange={() => chooseType(t)} />
                  <span>
                    <RoleBadge type={t} />
                    <small>
                      {SHIFT_KEYS.map((s) => `${SHIFTS[s].short} ${shown.shifts[s][t]}/${LIMITS[t]}`).join(' · ')}
                    </small>
                    {full && <small className="col-choice__full">Both shifts are full</small>}
                  </span>
                </label>
              )
            })}
          </fieldset>
        )}

        <fieldset className="col-choices is-wide" aria-label="Shift" aria-describedby={errors.shift ? 'col-shift-error' : undefined}>
          <legend className="ct-label">Shift *</legend>
          {SHIFT_KEYS.map((s) => {
            const full = shiftFull(s)
            const own = editing && record.active && record.shift === s && record.truckId === truck.id
            return (
              <label key={s} className="col-choice">
                <input type="radio" name="col-shift" value={s} checked={form.shift === s} disabled={full} onChange={() => setForm((f) => ({ ...f, shift: s }))} />
                <span>
                  <strong>{SHIFTS[s].label}</strong>
                  <small>{SHIFTS[s].hours}</small>
                  <small>
                    {countLabel(type, s)}: {shown.shifts[s][type]}/{LIMITS[type]}
                    {own && ' (includes this person)'}
                  </small>
                  {full && <small className="col-choice__full">Full</small>}
                </span>
              </label>
            )
          })}
          {editing && !record.shift && (
            <label className="col-choice">
              <input type="radio" name="col-shift" value="" checked={form.shift === ''} onChange={() => setForm((f) => ({ ...f, shift: '' }))} />
              <span>
                <strong>Not on a shift</strong>
                <small>Keep this person off the {truck.id} roster</small>
              </span>
            </label>
          )}
        </fieldset>

        {(errors.shift || chosenFull) && (
          <div id="col-shift-error" className="ct-alert ct-alert--error col-form-note" role="alert">
            <AlertTriangle size={16} />
            <span>
              {chosenFull ? fullMessage(type, form.shift) : errors.shift} Choose another shift, or save this person as Inactive.
            </span>
          </div>
        )}
        {!chosenFull && allFull && (
          <div className="ct-alert ct-alert--warning col-form-note" role="status">
            <AlertTriangle size={16} />
            <span>Both shifts already have their {ROLES[type].plural.toLowerCase()}.</span>
          </div>
        )}

        <fieldset className="col-choices is-wide" aria-label="Status">
          <legend className="ct-label">Status</legend>
          {[
            [true, 'Active', 'Takes a place on the shift'],
            [false, 'Inactive', 'Record kept; frees the shift place'],
          ].map(([value, label, hint]) => (
            <label key={label} className="col-choice">
              <input type="radio" name="col-active" checked={form.active === value} onChange={() => setForm((f) => ({ ...f, active: value }))} />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <Field label={isDriver ? 'Mobile Number' : 'Mobile Number (optional)'} htmlFor="col-phone" required={isDriver} error={errors.phone} hint="Work contact only.">
          <input id="col-phone" className="ct-input" type="tel" placeholder="0917 555 0142" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
        </Field>
        {isDriver ? (
          <Field label="License Type" htmlFor="col-license" required error={errors.license}>
            <input id="col-license" className="ct-input" value={form.license} onChange={set('license')} aria-invalid={!!errors.license} />
          </Field>
        ) : (
          <Field label="Position" htmlFor="col-position">
            <select id="col-position" className="ct-input" value={form.position} onChange={set('position')}>
              {crewRoles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
        )}

        {isDriver && (
          <>
            <Field label="Sign-in email (optional)" htmlFor="col-email" error={errors.email} hint="Needed for the driver to use the Driver app.">
              <input id="col-email" className="ct-input" type="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
            </Field>
            <Field
              label={editing ? 'New password (optional)' : 'Password (optional)'}
              htmlFor="col-pw"
              error={errors.password}
              hint={editing ? 'Leave empty to keep the current password.' : 'Give this to the driver privately.'}
            >
              <div className="ct-input-group">
                <Lock size={16} />
                <input id="col-pw" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={set('password')} aria-invalid={!!errors.password} />
                <PasswordToggle visible={showPw} onToggle={() => setShowPw((v) => !v)} />
              </div>
            </Field>
            {editing && rec.account !== 'none' && (
              <Field label="Sign-in account" htmlFor="col-account">
                <select id="col-account" className="ct-input" value={form.account} onChange={set('account')}>
                  <option value="active">Active (can sign in)</option>
                  <option value="disabled">Disabled (cannot sign in)</option>
                </select>
              </Field>
            )}
          </>
        )}

        {editing && (
          <p className="ct-field__hint col-form-note">
            <Info size={12} /> Changing the name, number or picture is always allowed. Changing the shift or making someone Active needs a free place on that shift.
          </p>
        )}
      </form>
    </Modal>
  )
}
