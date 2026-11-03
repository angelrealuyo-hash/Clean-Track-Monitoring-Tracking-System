import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import { driverStatusMeta } from '../../../store/selectors.js'
import { shiftLabel } from '../../../data/personnel.js'

// PDF page 15 (Assign Driver). Only active drivers on one of the truck's
// shifts can drive it (see Collector's Management).
export default function AssignDriverModal({ truck, drivers: allDrivers, onSave, onClose }) {
  const [driverId, setDriverId] = useState(truck.driverId ?? '')
  const drivers = allDrivers.filter((d) => d.active !== false && d.truckId === truck.id && d.shift)

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
        Select the driver on duty for <strong>{truck.id}</strong>. Only active Morning and Afternoon Shift drivers are listed.
      </p>
      <div className="ct-options" role="radiogroup" aria-label="Driver">
        {drivers.map((d) => (
          <label key={d.id} className="ct-option">
            <input type="radio" name="driver" value={d.id} checked={driverId === d.id} onChange={() => setDriverId(d.id)} />
            <span className="ct-avatar">{d.initials}</span>
            <span>
              <strong>{d.name}</strong>
              <small>
                {shiftLabel(d.shift)} · {driverStatusMeta[d.status].label}
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
