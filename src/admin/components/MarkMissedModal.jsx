import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Field from '../../components/Field.jsx'
import { missedReasons } from '../../data/routes.js'

// Records why a stop was not collected (Collection Monitoring → Report Issue).
export default function MarkMissedModal({ stop, onSave, onClose }) {
  const [reason, setReason] = useState(missedReasons[0])
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    if (reason === 'Other' && !details.trim()) {
      setError('Please describe what happened.')
      return
    }
    onSave([reason, details.trim()].filter(Boolean).join(' — '))
  }

  return (
    <Modal
      title="Report Missed Stop"
      subtitle={stop.name}
      icon={TriangleAlert}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="missed-form" className="ct-btn ct-btn--danger-solid">
            Mark as Missed
          </button>
        </>
      }
    >
      <form id="missed-form" onSubmit={submit} noValidate>
        <Field label="Reason" htmlFor="mm-reason">
          <select id="mm-reason" className="ct-input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {missedReasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Details" htmlFor="mm-details" error={error} hint={reason === 'Other' ? 'Required' : 'Optional'}>
          <textarea id="mm-details" className="ct-input" maxLength={250} value={details} onChange={(e) => setDetails(e.target.value)} aria-invalid={!!error} />
        </Field>
      </form>
    </Modal>
  )
}
