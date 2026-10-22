import { useState } from 'react'
import { UserPen, UserPlus } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { shiftOptions } from '../../../data/drivers.js'
import { driverStatusMeta } from '../../../store/selectors.js'

// Add or edit a driver. `driver` is null when adding.
export default function DriverFormModal({ driver, onSave, onClose }) {
  const editing = Boolean(driver)
  const [form, setForm] = useState({
    name: driver?.name ?? '',
    phone: driver?.phone ?? '+63 ',
    license: driver?.license ?? 'Professional Driver (Class 2)',
    shift: driver?.shift ?? shiftOptions[0],
    status: driver?.status ?? 'standby',
  })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().length < 3) errs.name = 'Enter the driver’s full name.'
    // Philippine mobile: +63 9XX XXX XXXX or 09XX XXX XXXX
    const digits = form.phone.replace(/\D/g, '')
    if (!/^(639\d{9}|09\d{9})$/.test(digits)) errs.phone = 'Use a PH mobile number, e.g. +63 917 555 0142.'
    if (!form.license.trim()) errs.license = 'License type is required.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({ ...form, name: form.name.trim().replace(/\s+/g, ' '), license: form.license.trim(), phone: form.phone.trim() })
  }

  return (
    <Modal
      title={editing ? `Edit Driver ${driver.id}` : 'Add New Driver'}
      subtitle={editing ? 'Update driver details' : 'Register a barangay collection driver'}
      icon={editing ? UserPen : UserPlus}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="driver-form" className="ct-btn ct-btn--primary">
            {editing ? 'Update Driver' : 'Add Driver'}
          </button>
        </>
      }
    >
      <form id="driver-form" className="ct-form-grid" onSubmit={submit} noValidate>
        <Field label="Full Name" htmlFor="d-name" required error={errors.name} className="is-wide">
          <input id="d-name" className="ct-input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Mobile Number" htmlFor="d-phone" required error={errors.phone}>
          <input id="d-phone" className="ct-input" type="tel" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="License Type" htmlFor="d-license" required error={errors.license}>
          <input id="d-license" className="ct-input" value={form.license} onChange={set('license')} aria-invalid={!!errors.license} />
        </Field>
        <Field label="Shift" htmlFor="d-shift">
          <select id="d-shift" className="ct-input" value={form.shift} onChange={set('shift')}>
            {shiftOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        {!editing && (
          <Field label="Availability" htmlFor="d-status">
            <select id="d-status" className="ct-input" value={form.status} onChange={set('status')}>
              {Object.entries(driverStatusMeta).map(([v, m]) => (
                <option key={v} value={v}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  )
}
