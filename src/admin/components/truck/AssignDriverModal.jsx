import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import { driverStatusMeta } from '../../../store/selectors.js'

// PDF page 15 (Assign Driver)
export default function AssignDriverModal({ truck, drivers, onSave, onClose }) {
  const [driverId, setDriverId] = useState(truck.driverId ?? '')

  return (
    <Modal
      title="Assign Driver"
      icon={UserPlus}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ct-btn ct-btn--primary" onClick={() => onSave(driverId || null)}>
            Assign Driver
          </button>
        </>
      }
    >
      <p>
        Select an authorized barangay driver for <strong>{truck.id}</strong>.
      </p>
      <div className="ct-options" role="radiogroup" aria-label="Driver">
        {drivers.map((d) => (
          <label key={d.id} className="ct-option">
            <input type="radio" name="driver" value={d.id} checked={driverId === d.id} onChange={() => setDriverId(d.id)} />
            <span className="ct-avatar">{d.initials}</span>
            <span>
              <strong>{d.name}</strong>
              <small>
                {d.shift} · {driverStatusMeta[d.status].label}
              </small>
            </span>
          </label>
        ))}
        <label className="ct-option">
          <input type="radio" name="driver" value="" checked={driverId === ''} onChange={() => setDriverId('')} />
          <span className="ct-avatar">—</span>
          <span>
            <strong>
              <em>Unassigned</em>
            </strong>
            <small>No driver assigned</small>
          </span>
        </label>
      </div>
    </Modal>
  )
}
