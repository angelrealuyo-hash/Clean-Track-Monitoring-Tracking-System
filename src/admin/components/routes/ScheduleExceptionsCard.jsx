import { useState } from 'react'
import { CalendarX2, Plus, Trash2 } from 'lucide-react'
import Field from '../../../components/Field.jsx'
import DatePicker from '../../../components/DatePicker.jsx'
import ConfirmModal from '../../../components/ConfirmModal.jsx'
import StatusBadge from '../../../components/StatusBadge.jsx'
import { useData } from '../../../store/dataContext.js'
import { useToast } from '../../../components/toast/toastContext.js'
import { exceptionKinds, exceptionLabel, isCollectionDate, scheduleLabel } from '../../../data/schedule.js'
import { formatDate, todayISO } from '../../../utils/format.js'

// Suspended pickup dates. A listed Mon/Wed/Fri has no regular pickup:
// residents see it on their calendar, and the driver cannot start a route.
const EMPTY = { date: '', kind: 'suspended', reason: '' }
const notPickupDay = (iso) => !isCollectionDate(iso)
export default function ScheduleExceptionsCard() {
  const { data, dispatch } = useData()
  const toast = useToast()
  const today = todayISO()
  const list = data.scheduleExceptions ?? []
  const upcoming = list.filter((x) => x.date >= today)
  const past = list.filter((x) => x.date < today)
  const [form, setForm] = useState(EMPTY)
  // Errors appear only after pressing Add, and clear as soon as that field changes.
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(null)
  const setValue = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e))
  }

  function validate() {
    const e = {}
    if (!form.date) e.date = 'Choose a date.'
    else if (form.date < today) e.date = 'Choose today or a future date.'
    else if (!isCollectionDate(form.date)) e.date = `Pick a ${scheduleLabel} date.`
    if (form.reason.trim().length < 3) e.reason = 'Write a short reason, e.g. “Truck under repair”.'
    return e
  }

  function add(e) {
    e.preventDefault()
    if (saving) return
    const found = validate()
    setErrors(found)
    if (found.date || found.reason) return
    setSaving(true)
    dispatch({ type: 'schedule/addException', payload: { ...form, reason: form.reason.trim() } }).then((res) => {
      setSaving(false)
      if (!res.ok) return
      toast(`${formatDate(form.date)}: no pickup · residents notified`)
      setForm(EMPTY)
    })
  }

  return (
    <article className="ct-card exceptions-card">
      <div className="ct-card__header">
        <div>
          <h2>
            <CalendarX2 size={16} /> Suspended Pickups
          </h2>
          <p>A listed date has no regular pickup. Residents are notified and see it on their calendar.</p>
        </div>
      </div>
      <div className="ct-card__body">
        <form className="exceptions-form" onSubmit={add} noValidate>
          <Field label="Date" htmlFor="ex-date" error={errors.date}>
            <DatePicker id="ex-date" value={form.date} min={today} isDisabled={notPickupDay} invalid={!!errors.date} onChange={(v) => setValue('date', v)} />
          </Field>
          <Field label="Type" htmlFor="ex-kind">
            <select id="ex-kind" className="ct-input" value={form.kind} onChange={(e) => setValue('kind', e.target.value)}>
              {Object.entries(exceptionKinds).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reason" htmlFor="ex-reason" error={errors.reason}>
            <input
              id="ex-reason"
              className="ct-input"
              maxLength={80}
              placeholder="e.g. Truck under repair"
              value={form.reason}
              onChange={(e) => setValue('reason', e.target.value)}
              aria-invalid={!!errors.reason || undefined}
            />
          </Field>
          <div className="exceptions-form__submit">
            <span className="ct-label" aria-hidden="true">
              &nbsp;
            </span>
            <button type="submit" className="ct-btn ct-btn--primary" disabled={saving}>
              <Plus size={15} /> {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>

        {upcoming.length === 0 ? (
          <p className="ct-empty">No upcoming suspensions.</p>
        ) : (
          <ul className="exceptions-list">
            {upcoming.map((x) => (
              <li key={x.date}>
                <strong>{formatDate(x.date)}</strong>
                <StatusBadge tone="red">{exceptionLabel(x.kind)}</StatusBadge>
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
