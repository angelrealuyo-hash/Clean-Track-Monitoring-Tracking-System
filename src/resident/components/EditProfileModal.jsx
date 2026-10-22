import { useState } from 'react'
import { UserPen } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Field from '../../components/Field.jsx'
import { barangay } from '../../data/barangay.js'
import { normalizePhone } from '../../utils/validate.js'

// Edit household information (Profile → Edit Profile Information).
export default function EditProfileModal({ resident, onSave, onClose }) {
  const [form, setForm] = useState({ name: resident.name, phone: resident.phone, address: resident.address, purok: resident.purok })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().split(/\s+/).length < 2) errs.name = 'Enter your first and last name.'
    const phone = normalizePhone(form.phone)
    if (!phone) errs.phone = 'Enter a PH mobile number, e.g. +63 917 555 0192.'
    if (form.address.trim().length < 5) errs.address = 'Enter your house number and street.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({ name: form.name.trim().replace(/\s+/g, ' '), phone, address: form.address.trim(), purok: form.purok })
  }

  return (
    <Modal
      title="Edit Profile"
      subtitle="Household information"
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
        <Field label="Full Name" htmlFor="pf-name" required error={errors.name}>
          <input id="pf-name" className="ct-input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Contact Mobile" htmlFor="pf-phone" required error={errors.phone}>
          <input id="pf-phone" className="ct-input" type="tel" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="Registered Address" htmlFor="pf-addr" required error={errors.address}>
          <input id="pf-addr" className="ct-input" value={form.address} onChange={set('address')} aria-invalid={!!errors.address} />
        </Field>
        <Field label="Purok" htmlFor="pf-purok" hint="Changes which truck alerts and advisories you get.">
          <select id="pf-purok" className="ct-input" value={form.purok} onChange={set('purok')}>
            {barangay.puroks.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <p className="ct-field__hint">Email ({resident.email}) is your sign-in and cannot be changed here.</p>
      </form>
    </Modal>
  )
}
