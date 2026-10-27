import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { wasteTypes } from '../../../data/routes.js'
import { to12h, to24h } from '../../../utils/format.js'

function splitWindow(window) {
  const [start, end] = (window ?? '').split(' - ')
  return { start: to24h(start), end: to24h(end) }
}

export default function EditScheduleModal({ entry, onSave, onClose }) {
  const initial = splitWindow(entry.window)
  const [form, setForm] = useState({ wasteType: entry.wasteType, start: initial.start || '06:00', end: initial.end || '10:00' })
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const none = form.wasteType === 'No collection'

  function submit(e) {
    e.preventDefault()
    if (!none && (!form.start || !form.end || form.end <= form.start)) {
      setError('End time must be after start time.')
      return
    }
    onSave({ wasteType: form.wasteType, window: none ? '-' : `${to12h(form.start)} - ${to12h(form.end)}` })
  }

  return (
    <Modal
      title={`${entry.day} Collection`}
      icon={CalendarDays}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ct-btn ct-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="sched-form" className="ct-btn ct-btn--primary">
            Save Schedule
          </button>
        </>
      }
    >
      <form id="sched-form" onSubmit={submit} noValidate>
        <Field label="Waste Type" htmlFor="sc-type">
          <select id="sc-type" className="ct-input" value={form.wasteType} onChange={set('wasteType')}>
            {wasteTypes.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </Field>
        {!none && (
          <div className="ct-form-grid">
            <Field label="Start" htmlFor="sc-start">
              <input id="sc-start" className="ct-input" type="time" value={form.start} onChange={set('start')} />
            </Field>
            <Field label="End" htmlFor="sc-end" error={error}>
              <input id="sc-end" className="ct-input" type="time" value={form.end} onChange={set('end')} aria-invalid={!!error} />
            </Field>
          </div>
        )}
      </form>
    </Modal>
  )
}
