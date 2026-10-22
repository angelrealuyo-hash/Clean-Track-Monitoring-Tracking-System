import { useState } from 'react'
import { Route } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { to12h, to24h } from '../../../utils/format.js'

export default function EditRouteModal({ route, simRunning, onSave, onClose }) {
  const [form, setForm] = useState({ name: route.name, shortName: route.shortName, startTime: to24h(route.startTime) })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().length < 3) errs.name = 'Route name is required.'
    if (!form.shortName.trim()) errs.shortName = 'Short name is required.'
    if (!form.startTime) errs.startTime = 'Start time is required.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave({ name: form.name.trim(), shortName: form.shortName.trim(), startTime: to12h(form.startTime) })
  }

  return (
    <Modal
      title="Edit Route"
      subtitle={`${route.id} · ${route.name}`}
      icon={Route}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="route-form" className="ct-btn ct-btn--primary">
            Save Route
          </button>
        </>
      }
    >
      <form id="route-form" onSubmit={submit} noValidate>
        <Field label="Route Name" htmlFor="r-name" required error={errors.name}>
          <input id="r-name" className="ct-input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Short Name" htmlFor="r-short" required error={errors.shortName} hint="Shown on maps and cards">
          <input id="r-short" className="ct-input" value={form.shortName} onChange={set('shortName')} aria-invalid={!!errors.shortName} />
        </Field>
        <Field label="Daily Start Time" htmlFor="r-start" required error={errors.startTime}>
          <input id="r-start" className="ct-input" type="time" value={form.startTime} onChange={set('startTime')} aria-invalid={!!errors.startTime} />
        </Field>
        {simRunning && (
          <div className="ct-alert ct-alert--warning">Saving restarts the running tracking simulation from the depot.</div>
        )}
      </form>
    </Modal>
  )
}
