import { useState } from 'react'
import { SquarePen } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { truckStatusMeta } from '../../../store/selectors.js'
import { fuelTypes, vehicleTypes } from '../../../data/truck.js'

// PDF page 14 (Edit Truck). Truck ID stays fixed; it is used across the system.
export default function EditTruckModal({ truck, onSave, onClose }) {
  const [form, setForm] = useState({
    plateNumber: truck.plateNumber,
    type: truck.type,
    model: truck.model,
    capacityTons: String(truck.capacityTons),
    fuel: truck.fuel,
    status: truck.status,
  })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.plateNumber.trim()) errs.plateNumber = 'Plate number is required.'
    const cap = Number(form.capacityTons)
    if (!Number.isFinite(cap) || cap <= 0 || cap > 30) errs.capacityTons = 'Enter a capacity between 0.1 and 30 tons.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({ ...form, plateNumber: form.plateNumber.trim().toUpperCase(), model: form.model.trim(), capacityTons: cap })
  }

  return (
    <Modal
      title={`Edit Truck ${truck.id}`}
      subtitle="Update vehicle details"
      icon={SquarePen}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-truck-form" className="ct-btn ct-btn--primary">
            Update Vehicle
          </button>
        </>
      }
    >
      <form id="edit-truck-form" className="ct-form-grid" onSubmit={submit} noValidate>
        <Field label="Truck ID" htmlFor="t-id" hint="Fixed; used by routes and tracking.">
          <input id="t-id" className="ct-input" value={truck.id} disabled />
        </Field>
        <Field label="Plate Number" htmlFor="t-plate" required error={errors.plateNumber}>
          <input id="t-plate" className="ct-input" value={form.plateNumber} onChange={set('plateNumber')} aria-invalid={!!errors.plateNumber} />
        </Field>
        <Field label="Vehicle Type" htmlFor="t-type" required>
          <select id="t-type" className="ct-input" value={form.type} onChange={set('type')}>
            {vehicleTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Compaction Capacity (tons)" htmlFor="t-cap" required error={errors.capacityTons}>
          <input id="t-cap" className="ct-input" type="number" step="0.1" min="0.1" value={form.capacityTons} onChange={set('capacityTons')} aria-invalid={!!errors.capacityTons} />
        </Field>
        <Field label="Fuel / Power Type" htmlFor="t-fuel">
          <select id="t-fuel" className="ct-input" value={form.fuel} onChange={set('fuel')}>
            {fuelTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="t-status" required>
          <select id="t-status" className="ct-input" value={form.status} onChange={set('status')}>
            {Object.entries(truckStatusMeta).map(([value, m]) => (
              <option key={value} value={value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Year & Model" htmlFor="t-model" className="is-wide">
          <input id="t-model" className="ct-input" value={form.model} onChange={set('model')} />
        </Field>
      </form>
    </Modal>
  )
}
