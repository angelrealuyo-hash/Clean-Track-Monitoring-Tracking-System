import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'

const options = [
  { value: 'on-shift', label: 'Active On Shift', hint: 'En route or operating collection' },
  { value: 'standby', label: 'On Standby / Ready', hint: 'Available for immediate relief' },
  { value: 'off-duty', label: 'Off-Duty / Leave', hint: 'Not scheduled for collection' },
]

// PDF page 20 (Change Status)
export default function ChangeStatusModal({ driver, onSave, onClose }) {
  const [status, setStatus] = useState(driver.status)
  return (
    <Modal
      title="Change Status"
      icon={RefreshCw}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ct-btn ct-btn--primary" onClick={() => onSave(status)}>
            Apply Status
          </button>
        </>
      }
    >
      <p>
        Select operational status for <strong>{driver.name}</strong>:
      </p>
      <div className="ct-options" role="radiogroup" aria-label="Availability">
        {options.map((o) => (
          <label key={o.value} className="ct-option">
            <input type="radio" name="status" value={o.value} checked={status === o.value} onChange={() => setStatus(o.value)} />
            <span>
              <strong>{o.label}</strong>
              <small>{o.hint}</small>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  )
}
