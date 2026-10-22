import { useState } from 'react'
import { Wrench } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { maintenanceTypes } from '../../../data/truck.js'
import { truckStatusMeta } from '../../../store/selectors.js'
import { todayISO } from '../../../utils/format.js'

// PDF page 16 (Log Maintenance Service)
export default function LogMaintenanceModal({ truck, onSave, onClose }) {
  const [form, setForm] = useState({
    type: maintenanceTypes[0],
    odometerKm: String(truck.odometerKm),
    date: todayISO(),
    newStatus: 'maintenance',
    nextServiceDate: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    const km = Number(form.odometerKm)
    if (!Number.isInteger(km) || km < truck.odometerKm) {
      errs.odometerKm = `Enter a whole number, at least ${truck.odometerKm.toLocaleString()} km (current reading).`
    }
    if (!form.date) errs.date = 'Service date is required.'
    if (form.nextServiceDate && form.date && form.nextServiceDate <= form.date) {
      errs.nextServiceDate = 'Next service must be after the service date.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({ ...form, odometerKm: km, notes: form.notes.trim() })
  }

  return (
    <Modal
      title="Log Maintenance Service"
      subtitle={`Vehicle: ${truck.id}`}
      icon={Wrench}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="maint-form" className="ct-btn ct-btn--primary">
            Log &amp; Update Truck
          </button>
        </>
      }
    >
      <form id="maint-form" className="ct-form-grid" onSubmit={submit} noValidate>
        <Field label="Maintenance Type" htmlFor="m-type" required>
          <select id="m-type" className="ct-input" value={form.type} onChange={set('type')}>
            {maintenanceTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Odometer (km)" htmlFor="m-km" required error={errors.odometerKm}>
          <input id="m-km" className="ct-input" type="number" min={truck.odometerKm} value={form.odometerKm} onChange={set('odometerKm')} aria-invalid={!!errors.odometerKm} />
        </Field>
        <Field label="Service Date" htmlFor="m-date" required error={errors.date}>
          <input id="m-date" className="ct-input" type="date" value={form.date} onChange={set('date')} aria-invalid={!!errors.date} />
        </Field>
        <Field label="New Vehicle Status" htmlFor="m-status">
          <select id="m-status" className="ct-input" value={form.newStatus} onChange={set('newStatus')}>
            {Object.entries(truckStatusMeta).map(([value, m]) => (
              <option key={value} value={value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Next Scheduled Service" htmlFor="m-next" error={errors.nextServiceDate} hint="Optional" className="is-wide">
          <input id="m-next" className="ct-input" type="date" value={form.nextServiceDate} onChange={set('nextServiceDate')} aria-invalid={!!errors.nextServiceDate} />
        </Field>
        <Field label="Technician / Inspector Notes" htmlFor="m-notes" className="is-wide">
          <textarea id="m-notes" className="ct-input" maxLength={300} placeholder="Replaced parts, fluid levels, follow-up recommendations…" value={form.notes} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  )
}
