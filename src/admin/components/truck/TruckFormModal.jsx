import { useState } from 'react'
import { SquarePen, Truck } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { truckStatusMeta } from '../../../store/selectors.js'
import {
  MIN_TRUCK_YEAR,
  fuelTypes,
  maxTruckYear,
  nextTruckId,
  plateKey,
  splitModel,
  truckIdKey,
  vehicleTypes,
} from '../../../data/truck.js'

// Add Truck and Edit Truck (PDF page 14). Truck ID is chosen when adding and
// stays fixed afterwards, because runs, routes and tracking refer to it.
// `trucks` = every registered truck (for the duplicate checks);
// `statuses` = the statuses this truck may have.
export default function TruckFormModal({ truck, trucks, statuses, onSave, onClose }) {
  const adding = !truck
  const { year, model } = splitModel(truck?.model)
  const [form, setForm] = useState({
    id: adding ? nextTruckId(trucks) : truck.id,
    plateNumber: truck?.plateNumber ?? '',
    type: truck?.type ?? vehicleTypes[0],
    year,
    model,
    capacityTons: truck ? String(truck.capacityTons ?? '') : '',
    fuel: truck?.fuel ?? fuelTypes[0],
    odometerKm: truck ? String(truck.odometerKm ?? 0) : '0',
    nextServiceDate: '',
    status: truck?.status ?? 'active',
  })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const others = trucks.filter((t) => t.id !== truck?.id)
  // Keep a current value that is not in the list (e.g. an older fuel name).
  const withCurrent = (list, value) => (value && !list.includes(value) ? [value, ...list] : list)

  function submit(e) {
    e.preventDefault()
    const errs = {}
    const id = truckIdKey(form.id)
    if (adding) {
      if (!id) errs.id = 'Truck ID is required.'
      else if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(id)) errs.id = 'Use 2-12 letters, numbers or dashes, e.g. TRK-02.'
      else if (others.some((t) => truckIdKey(t.id) === id)) errs.id = `${id} is already registered.`
    }
    const plate = form.plateNumber.trim().toUpperCase().replace(/\s+/g, ' ')
    const plateOwner = others.find((t) => plateKey(t.plateNumber) === plateKey(plate))
    if (plateKey(plate).length < 2) errs.plateNumber = 'Plate number is required.'
    else if (plateOwner) errs.plateNumber = `Already registered to ${plateOwner.id}.`
    if (form.year !== '') {
      const y = Number(form.year)
      if (!Number.isInteger(y) || y < MIN_TRUCK_YEAR || y > maxTruckYear()) errs.year = `Enter a year from ${MIN_TRUCK_YEAR} to ${maxTruckYear()}.`
    }
    const cap = Number(form.capacityTons)
    if (form.capacityTons === '' || !Number.isFinite(cap) || cap <= 0 || cap > 30) errs.capacityTons = 'Enter a capacity between 0.1 and 30 tons.'
    const km = Number(form.odometerKm)
    if (adding && (form.odometerKm === '' || !Number.isInteger(km) || km < 0 || km > 2_000_000)) errs.odometerKm = 'Enter a whole number of km (0 or more).'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({
      ...(adding ? { id, odometerKm: km, nextServiceDate: form.nextServiceDate || null } : { id: truck.id }),
      plateNumber: plate,
      type: form.type,
      year: form.year === '' ? '' : Number(form.year),
      model: form.model.trim(),
      capacityTons: cap,
      fuel: form.fuel,
      status: form.status,
    })
  }

  const formId = adding ? 'add-truck-form' : 'edit-truck-form'
  return (
    <Modal
      title={adding ? 'Add Truck' : `Edit Truck ${truck.id}`}
      subtitle={adding ? 'Register a garbage truck. It is added as a reserve truck.' : 'Update vehicle details'}
      icon={adding ? Truck : SquarePen}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className="ct-btn ct-btn--primary">
            {adding ? 'Add Truck' : 'Update Vehicle'}
          </button>
        </>
      }
    >
      <form id={formId} className="ct-form-grid" onSubmit={submit} noValidate>
        <Field label="Truck ID" htmlFor="t-id" required={adding} error={errors.id} hint={adding ? 'Cannot be changed later.' : 'Fixed; used by routes and tracking.'}>
          <input id="t-id" className="ct-input" value={form.id} onChange={set('id')} disabled={!adding} maxLength={12} aria-invalid={!!errors.id} />
        </Field>
        <Field label="Plate Number" htmlFor="t-plate" required error={errors.plateNumber}>
          <input id="t-plate" className="ct-input" value={form.plateNumber} onChange={set('plateNumber')} maxLength={15} placeholder="e.g. NBC-2087" aria-invalid={!!errors.plateNumber} />
        </Field>
        <Field label="Vehicle Type" htmlFor="t-type" required>
          <select id="t-type" className="ct-input" value={form.type} onChange={set('type')}>
            {withCurrent(vehicleTypes, form.type).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="t-status" required>
          <select id="t-status" className="ct-input" value={form.status} onChange={set('status')}>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {truckStatusMeta[value].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Year" htmlFor="t-year" error={errors.year} hint="Optional">
          <input id="t-year" className="ct-input" type="number" min={MIN_TRUCK_YEAR} max={maxTruckYear()} value={form.year} onChange={set('year')} placeholder="e.g. 2022" aria-invalid={!!errors.year} />
        </Field>
        <Field label="Model" htmlFor="t-model" hint="Optional">
          <input id="t-model" className="ct-input" value={form.model} onChange={set('model')} maxLength={50} placeholder="e.g. Isuzu Elf N-Series" />
        </Field>
        <Field label="Compaction Capacity (tons)" htmlFor="t-cap" required error={errors.capacityTons}>
          <input id="t-cap" className="ct-input" type="number" step="0.1" min="0.1" max="30" value={form.capacityTons} onChange={set('capacityTons')} aria-invalid={!!errors.capacityTons} />
        </Field>
        <Field label="Fuel / Power Type" htmlFor="t-fuel" required>
          <select id="t-fuel" className="ct-input" value={form.fuel} onChange={set('fuel')}>
            {withCurrent(fuelTypes, form.fuel).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        {adding && (
          <>
            <Field label="Odometer (km)" htmlFor="t-km" required error={errors.odometerKm}>
              <input id="t-km" className="ct-input" type="number" min="0" step="1" value={form.odometerKm} onChange={set('odometerKm')} aria-invalid={!!errors.odometerKm} />
            </Field>
            <Field label="Next Scheduled Service" htmlFor="t-next" hint="Optional">
              <input id="t-next" className="ct-input" type="date" value={form.nextServiceDate} onChange={set('nextServiceDate')} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  )
}
