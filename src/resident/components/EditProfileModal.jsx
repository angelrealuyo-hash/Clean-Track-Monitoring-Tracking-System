import { useState } from 'react'
import { UserPen } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Field from '../../components/Field.jsx'
import { barangay } from '../../data/barangay.js'
import { normalizePhone } from '../../utils/validate.js'

// Edit household information (Profile → Edit Profile Information).
export default function EditProfileModal({ resident, onSave, onClose }) {
  const [form, setForm] = useState({ name: resident.name, phone: resident.phone, email: resident.email ?? '', address: resident.address, purok: resident.purok })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().split(/\s+/).length < 2) errs.name = 'Enter your first and last name.'
    const phone = normalizePhone(form.phone)
    const email = form.email.trim().toLowerCase()
    if (email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) errs.email = 'Use a plain email like name@example.com, or leave it empty.'
    if (!phone) errs.phone = 'Enter a PH mobile number, e.g. +63 917 555 0192.'
    if (form.address.trim().length < 5) errs.address = 'Enter your house number and street.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({ name: form.name.trim().replace(/\s+/g, ' '), phone, email, address: form.address.trim(), purok: form.purok })
  }

  return (
    <Modal
      title="Edit My Details"
      icon={UserPen}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="profile-form" className="ct-btn ct-btn--primary">
            Save Changes
          </button>
        </>
      }
    >
      <form id="profile-form" onSubmit={submit} noValidate>
        <Field label="Full name" htmlFor="pf-name" required error={errors.name}>
          <input id="pf-name" className="ct-input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Mobile number" htmlFor="pf-phone" required error={errors.phone}>
          <input id="pf-phone" className="ct-input" type="tel" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="House number and street" htmlFor="pf-addr" required error={errors.address}>
          <input id="pf-addr" className="ct-input" value={form.address} onChange={set('address')} aria-invalid={!!errors.address} />
        </Field>
        <Field label="Area (Purok)" htmlFor="pf-purok" hint="We use this to tell you when the truck is near.">
          <select id="pf-purok" className="ct-input" value={form.purok} onChange={set('purok')}>
            {barangay.puroks.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Email (optional)" htmlFor="pf-email" error={errors.email} hint="For email notifications. You can also sign in with it.">
          <input id="pf-email" className="ct-input" type="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} />
        </Field>
      </form>
    </Modal>
  )
}
