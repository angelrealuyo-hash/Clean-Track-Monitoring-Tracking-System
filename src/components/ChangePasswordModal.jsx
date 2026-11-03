import { useState } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import PasswordToggle from './PasswordToggle.jsx'
import Modal from './Modal.jsx'
import Field from './Field.jsx'
import { api } from '../api/client.js'
import { useData } from '../store/dataContext.js'
import { useToast } from './toast/toastContext.js'

// Change your own password. The server checks the current password.
export default function ChangePasswordModal({ onClose }) {
  const { token } = useData()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', next: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState({ current: false, next: false })
  const flip = (key) => () => setShow((v) => ({ ...v, [key]: !v[key] }))

  async function submit(e) {
    e.preventDefault()
    if (form.next.length < 6) return setError('Use at least 6 characters for the new password.')
    setBusy(true)
    try {
      await api('/auth/password', { token, body: form })
      toast('Password changed')
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Change Password"
      icon={KeyRound}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="pw-form" className="ct-btn ct-btn--primary" disabled={busy}>
            Save Password
          </button>
        </>
      }
    >
      <form id="pw-form" onSubmit={submit} noValidate>
        <Field label="Current password" htmlFor="pw-current" required>
          <div className="ct-input-group">
            <Lock size={16} />
            <input id="pw-current" type={show.current ? 'text' : 'password'} autoComplete="current-password" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} />
            <PasswordToggle visible={show.current} onToggle={flip('current')} label="current password" />
          </div>
        </Field>
        <Field label="New password" htmlFor="pw-next" required error={error} hint="At least 6 characters.">
          <div className="ct-input-group">
            <Lock size={16} />
            <input id="pw-next" type={show.next ? 'text' : 'password'} autoComplete="new-password" value={form.next} onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} aria-invalid={!!error} />
            <PasswordToggle visible={show.next} onToggle={flip('next')} label="new password" />
          </div>
        </Field>
      </form>
    </Modal>
  )
}
