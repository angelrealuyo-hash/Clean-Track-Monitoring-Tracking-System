import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import Modal from '../../../components/Modal.jsx'
import Field from '../../../components/Field.jsx'
import { scheduleLabel } from '../../../data/schedule.js'
import { to12h, to24h } from '../../../utils/format.js'

function splitWindow(window) {
  const [start, end] = (window ?? '').split(' - ')
  return { start: to24h(start), end: to24h(end) }
}

// Pickup time for one of the official collection days (Mon/Wed/Fri).
export default function EditScheduleModal({ entry, onSave, onClose }) {
  const initial = splitWindow(entry.window)
  const [form, setForm] = useState({ start: initial.start || '06:00', end: initial.end || '10:00' })
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    if (!form.start || !form.end || form.end <= form.start) {
      setError('End time must be after start time.')
      return
    }
    onSave({ window: `${to12h(form.start)} - ${to12h(form.end)}` })
  }

  return (
    <Modal
      title={`${entry.day} Collection`}
      subtitle={`Official collection days: ${scheduleLabel}`}
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
        <div className="ct-form-grid">
          <Field label="Pickup starts" htmlFor="sc-start">
            <input id="sc-start" className="ct-input" type="time" value={form.start} onChange={set('start')} />
          </Field>
          <Field label="Pickup ends" htmlFor="sc-end" error={error}>
            <input id="sc-end" className="ct-input" type="time" value={form.end} onChange={set('end')} aria-invalid={!!error} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}
