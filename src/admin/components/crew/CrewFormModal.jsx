import { useState } from 'react'
import { UserPen, UserPlus } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import AvatarPicker from '../../../components/AvatarPicker.jsx'
import { initials } from '../../../store/dataReducer.js'
import { crewRoles, crewStatusMeta } from '../../../data/crew.js'

// Add or edit a crew member. `member` is null when adding.
export default function CrewFormModal({ member, truck, onSave, onClose, saving = false }) {
  const editing = Boolean(member)
  const [form, setForm] = useState({
    name: member?.name ?? '',
    role: member?.role ?? crewRoles[0],
    phone: member?.phone ?? '',
    truckId: member ? (member.truckId ?? '') : truck.id,
    status: member?.status ?? 'active',
    photo: member?.photo ?? null,
  })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    if (saving) return
    const errs = {}
    if (form.name.trim().length < 3) errs.name = 'Enter the crew member’s full name.'
    const digits = form.phone.replace(/\D/g, '')
    if (digits && !/^(639\d{9}|09\d{9})$/.test(digits)) errs.phone = 'Use a PH mobile number, e.g. 0917 555 0142, or leave it empty.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const out = { name: form.name.trim().replace(/\s+/g, ' '), role: form.role, phone: form.phone.trim(), truckId: form.truckId || null, status: form.status }
    // Only send the picture when it changed (new, replaced or removed).
    if (form.photo !== (member?.photo ?? null)) out.photo = form.photo
    onSave(out)
  }

  return (
    <Modal
      title={editing ? `Edit Crew Member ${member.id}` : 'Add Crew Member'}
      subtitle={editing ? 'Update crew member details' : 'Someone who works on the garbage truck with the driver'}
      icon={editing ? UserPen : UserPlus}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="crew-form" className="ct-btn ct-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update Crew Member' : 'Add Crew Member'}
          </button>
        </>
      }
    >
      <form id="crew-form" className="ct-form-grid" onSubmit={submit} noValidate>
        <div className="ct-field is-wide">
          <span className="ct-label">Profile Picture (optional)</span>
          <AvatarPicker value={form.photo} onChange={(photo) => setForm((f) => ({ ...f, photo }))} initials={initials(form.name || '?')} name={form.name} busy={saving} />
        </div>
        <Field label="Full Name" htmlFor="c-name" required error={errors.name} className="is-wide">
          <input id="c-name" className="ct-input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Role / Position" htmlFor="c-role" required>
          <select id="c-role" className="ct-input" value={form.role} onChange={set('role')}>
            {crewRoles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Mobile Number (optional)" htmlFor="c-phone" error={errors.phone} hint="Work contact only.">
          <input id="c-phone" className="ct-input" type="tel" placeholder="0917 555 0142" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} />
        </Field>
        <Field label="Assigned Truck" htmlFor="c-truck">
          <select id="c-truck" className="ct-input" value={form.truckId} onChange={set('truckId')}>
            <option value="">Unassigned</option>
            <option value={truck.id}>
              {truck.id} · {truck.plateNumber}
            </option>
          </select>
        </Field>
        <Field label="Status" htmlFor="c-status">
          <select id="c-status" className="ct-input" value={form.status} onChange={set('status')}>
            {Object.entries(crewStatusMeta).map(([v, m]) => (
              <option key={v} value={v}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  )
}
