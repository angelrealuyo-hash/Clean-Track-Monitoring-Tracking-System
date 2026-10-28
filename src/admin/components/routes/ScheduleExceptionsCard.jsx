import { useState } from 'react'
import { CalendarX2, Plus, Trash2 } from 'lucide-react'
import Field from '../../../components/Field.jsx'
import ConfirmModal from '../../../components/ConfirmModal.jsx'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { useData } from '../../../store/dataContext.js'
import { useToast } from '../../../components/toast/toastContext.js'
import { exceptionKinds, isCollectionDate, scheduleLabel } from '../../../data/schedule.js'
import { formatDate, todayISO } from '../../../utils/format.js'

// Holidays and suspended pickup dates. A listed Mon/Wed/Fri has no regular
// pickup: residents see it on their calendar, and the driver cannot start a route.
export default function ScheduleExceptionsCard() {
  const { data, dispatch } = useData()
  const toast = useToast()
  const today = todayISO()
  const list = data.scheduleExceptions ?? []
  const upcoming = list.filter((x) => x.date >= today)
  const past = list.filter((x) => x.date < today)
  const [form, setForm] = useState({ date: '', kind: 'holiday', reason: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function add(e) {
    e.preventDefault()
    if (saving) return
    if (!form.date) return setError('Choose a date.')
    if (form.date < today) return setError('Choose today or a future date.')
    if (!isCollectionDate(form.date)) return setError(`Pick a ${scheduleLabel} date (other days have no pickup anyway).`)
    if (form.reason.trim().length < 3) return setError('Write a short reason, e.g. “Christmas Day”.')
    setError('')
    setSaving(true)
    dispatch({ type: 'schedule/addException', payload: { ...form, reason: form.reason.trim() } }).then((res) => {
      setSaving(false)
      if (!res.ok) return
      toast(`${formatDate(form.date)}: no pickup · residents notified`)
      setForm({ date: '', kind: 'holiday', reason: '' })
    })
  }

  return (
    <article className="ct-card">
      <div className="ct-card__header">
        <div>
          <h2>
            <CalendarX2 size={16} /> Holidays &amp; Suspended Pickups
          </h2>
          <p>A listed date has no regular pickup. Residents are notified and see it on their calendar.</p>
        </div>
      </div>
      <div className="ct-card__body">
        <form className="exceptions-form" onSubmit={add} noValidate>
          <Field label="Date" htmlFor="ex-date" error={error}>
            <input id="ex-date" className="ct-input" type="date" min={today} value={form.date} onChange={set('date')} aria-invalid={!!error} />
          </Field>
          <Field label="Type" htmlFor="ex-kind">
            <select id="ex-kind" className="ct-input" value={form.kind} onChange={set('kind')}>
              {Object.entries(exceptionKinds).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reason" htmlFor="ex-reason">
            <input id="ex-reason" className="ct-input" maxLength={80} placeholder="e.g. Christmas Day" value={form.reason} onChange={set('reason')} />
          </Field>
          <button type="submit" className="ct-btn ct-btn--primary" disabled={saving}>
            <Plus size={15} /> {saving ? 'Saving…' : 'Add'}
          </button>
        </form>

        {upcoming.length === 0 ? (
          <p className="ct-empty">No upcoming holidays or suspensions.</p>
        ) : (
          <ul className="exceptions-list">
            {upcoming.map((x) => (
              <li key={x.date}>
                <strong>{formatDate(x.date)}</strong>
                <StatusBadge tone={x.kind === 'holiday' ? 'amber' : 'red'}>{exceptionKinds[x.kind]}</StatusBadge>
                <span className="exceptions-list__reason">{x.reason}</span>
                <button type="button" className="ct-icon-btn" aria-label={`Remove ${formatDate(x.date)}`} onClick={() => setRemoving(x)}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && <small className="exceptions-past">{past.length} past date(s) kept for the record.</small>}
      </div>

      {removing && (
        <ConfirmModal
          title="Remove this date?"
          confirmLabel="Remove"
          onClose={() => setRemoving(null)}
          onConfirm={() =>
            dispatch({ type: 'schedule/removeException', payload: { date: removing.date } }).then((res) => res.ok && toast(`${formatDate(removing.date)} is a pickup day again`))
          }
        >
          <p>
            {formatDate(removing.date)} will be a regular pickup day again. Residents already told about it are not messaged again; send an
            announcement from Notifications if needed.
          </p>
        </ConfirmModal>
      )}
    </article>
  )
}
