import { useState } from 'react'
import { MapPin } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { isCollectionStop } from '../../../services/trackingSimulation.js'

// Edits a stop's name, purok and bin count. Coordinates live in data/routes.js
// (see the note there) because they must come from a verified source.
export default function EditStopModal({ stop, number, puroks, simRunning, onSave, onClose }) {
  const depot = !isCollectionStop(stop)
  const [form, setForm] = useState({ name: stop.name, purok: stop.purok, bins: String(stop.bins) })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().length < 3) errs.name = 'Stop name is required.'
    const bins = Number(form.bins)
    if (!depot && (!Number.isInteger(bins) || bins < 1 || bins > 100)) errs.bins = 'Enter 1 to 100 bins.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSave(depot ? { name: form.name.trim() } : { name: form.name.trim(), purok: form.purok, bins })
  }

  return (
    <Modal
      title={`Edit Stop ${number}`}
      subtitle={depot ? 'Depot (start/end point)' : 'Collection stop'}
      icon={MapPin}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="stop-form" className="ct-btn ct-btn--primary">
            Save Stop
          </button>
        </>
      }
    >
      <form id="stop-form" onSubmit={submit} noValidate>
        <Field label="Stop Name" htmlFor="s-name" required error={errors.name}>
          <input id="s-name" className="ct-input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
        </Field>
        {!depot && (
          <div className="ct-form-grid">
            <Field label="Purok" htmlFor="s-purok">
              <select id="s-purok" className="ct-input" value={form.purok} onChange={set('purok')}>
                {puroks.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Bins at this stop" htmlFor="s-bins" required error={errors.bins}>
              <input id="s-bins" className="ct-input" type="number" min="1" max="100" value={form.bins} onChange={set('bins')} aria-invalid={!!errors.bins} />
            </Field>
          </div>
        )}
        <p className="ct-field__hint">
          Map coordinates: <span className="ct-mono">{stop.coords.join(', ')}</span>. To change them, edit{' '}
          <span className="ct-mono">src/data/routes.js</span> with verified locations.
        </p>
        {simRunning && (
          <div className="ct-alert ct-alert--warning">Saving restarts the running tracking simulation from the depot.</div>
        )}
      </form>
    </Modal>
  )
}
