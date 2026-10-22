import { useState } from 'react'
import { Bell, Mail, Megaphone, Send } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Field from '../../components/Field.jsx'
import { barangay } from '../../data/barangay.js'

// PDF page 28 (Create Resident Broadcast)
export default function NotifyResidentsModal({ onSend, onClose }) {
  const [form, setForm] = useState({ zone: 'All Puroks', subject: '', message: '', app: true, email: false })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.subject.trim().length < 4) errs.subject = 'Write a short subject.'
    if (form.message.trim().length < 10) errs.message = 'Write the message residents should read (at least 10 characters).'
    if (!form.app && !form.email) errs.channels = 'Pick at least one delivery channel.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSend({
      zone: form.zone,
      subject: form.subject.trim(),
      message: form.message.trim(),
      channels: [form.app && 'App', form.email && 'Email'].filter(Boolean),
    })
  }

  return (
    <Modal
      title="Create Resident Broadcast"
      subtitle="Send an advisory to registered residents"
      icon={Megaphone}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="broadcast-form" className="ct-btn ct-btn--primary">
            <Send size={15} /> Send Broadcast
          </button>
        </>
      }
    >
      <form id="broadcast-form" onSubmit={submit} noValidate>
        <Field label="Recipient Zone" htmlFor="b-zone">
          <select id="b-zone" className="ct-input" value={form.zone} onChange={set('zone')}>
            <option>All Puroks</option>
            {barangay.puroks.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Subject" htmlFor="b-subject" required error={errors.subject}>
          <input id="b-subject" className="ct-input" maxLength={80} placeholder="e.g. Organic Collection Schedule Update" value={form.subject} onChange={set('subject')} aria-invalid={!!errors.subject} />
        </Field>
        <Field label="Message" htmlFor="b-message" required error={errors.message} hint={`${form.message.length}/300`}>
          <textarea id="b-message" className="ct-input" maxLength={300} placeholder="e.g. The truck is running 20 minutes late due to road clearing. Please keep bins secured." value={form.message} onChange={set('message')} aria-invalid={!!errors.message} />
        </Field>
        <div className="ct-field">
          <span className="ct-label">Delivery Channels</span>
          <div className="broadcast-channels">
            <label className="ct-option">
              <input type="checkbox" checked={form.app} onChange={set('app')} />
              <Bell size={16} />
              <span>
                <strong>In-App Notification</strong>
                <small>CleanTrack Resident app</small>
              </span>
            </label>
            <label className="ct-option">
              <input type="checkbox" checked={form.email} onChange={set('email')} />
              <Mail size={16} />
              <span>
                <strong>Email</strong>
                <small>Recorded only in this demo</small>
              </span>
            </label>
          </div>
          {errors.channels && <span className="ct-field__error">{errors.channels}</span>}
        </div>
        <div className="ct-alert ct-alert--warning">
          Demo: the message appears in the Resident app&apos;s notifications. No email or SMS is actually sent.
        </div>
      </form>
    </Modal>
  )
}
