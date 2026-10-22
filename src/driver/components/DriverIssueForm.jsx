import { useState } from 'react'
import { ArrowLeft, Ban, CircleHelp, PackageX, Send, ShieldAlert, Trash2, Wrench } from 'lucide-react'
import Field from '../../components/Field.jsx'
import PhotoPicker from '../../components/PhotoPicker.jsx'

const issueTypes = [
  { id: 'blocked', label: 'Road Blocked / Alley Inaccessible', hint: 'Street obstructed or tight turns', icon: Ban },
  { id: 'overflow', label: 'Severe Overflow / Hazard', hint: 'Illegal dump or heavy spillage', icon: Trash2 },
  { id: 'bin', label: 'Damaged / Missing Bin', hint: 'Broken wheels, lid, or gone', icon: PackageX },
  { id: 'truck', label: 'Truck Mechanical Issue', hint: 'Hydraulic lift or tire problem', icon: Wrench },
  { id: 'safety', label: 'Safety Risk', hint: 'Aggressive animals, live wire', icon: ShieldAlert },
  { id: 'other', label: 'Other Incident', hint: 'Anything else at this stop', icon: CircleHelp },
]

// Driver "Report a Problem" at a stop (PDF page 47, right).
export default function DriverIssueForm({ stop, number, driverName, onSubmit, onCancel }) {
  const [form, setForm] = useState({ type: 'blocked', description: '', photo: null, notifyDispatch: true, markMissed: true })
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function submit(e) {
    e.preventDefault()
    if (form.description.trim().length < 10) {
      setError('Describe the problem (at least 10 characters).')
      return
    }
    if (!form.notifyDispatch && !form.markMissed) {
      setError('Choose at least one: notify dispatch, or mark the stop as missed.')
      return
    }
    const type = issueTypes.find((t) => t.id === form.type)
    onSubmit({
      stopId: stop.id,
      stopName: stop.name,
      issueType: type.id,
      issueLabel: type.label,
      description: form.description.trim(),
      photo: form.photo,
      notifyDispatch: form.notifyDispatch,
      markMissed: form.markMissed,
      driverName,
    })
  }

  return (
    <form className="m-page" onSubmit={submit} noValidate>
      <header className="m-subhead">
        <button type="button" className="ct-icon-btn" onClick={onCancel} aria-label="Back to stop">
          <ArrowLeft size={18} />
        </button>
        <div className="m-grow">
          <h1>Report a Problem</h1>
          <p>
            Stop #{number} · {stop.name}
          </p>
        </div>
      </header>

      <div className="m-row m-row--between">
        <h2 className="m-section-title">Select Issue Type</h2>
        <span className="m-muted">Required *</span>
      </div>
      <div className="m-choice-grid" role="radiogroup" aria-label="Issue type">
        {issueTypes.map((t) => {
          const Icon = t.icon
          return (
            <label key={t.id} className="m-choice">
              <span className="m-icon">
                <Icon size={16} />
              </span>
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
              <input type="radio" name="issue" value={t.id} checked={form.type === t.id} onChange={set('type')} />
            </label>
          )
        })}
      </div>

      <section className="m-card">
        <Field label="Short Description" htmlFor="di-desc" required error={error} hint={`${form.description.length}/250`}>
          <textarea
            id="di-desc"
            className="ct-input"
            maxLength={250}
            placeholder="e.g. Delivery truck parked across the alley; cannot reach communal bin #22 safely."
            value={form.description}
            onChange={(e) => {
              setError('')
              set('description')(e)
            }}
            aria-invalid={!!error}
          />
        </Field>
        <div className="ct-field">
          <span className="ct-label">Evidence Photo (optional)</span>
          <PhotoPicker value={form.photo} onChange={(photo) => setForm((f) => ({ ...f, photo }))} />
        </div>
        <label className="ct-checkbox">
          <input type="checkbox" checked={form.notifyDispatch} onChange={set('notifyDispatch')} />
          <span>
            <strong>Notify barangay dispatch</strong> (high priority alert on the Admin website)
          </span>
        </label>
        <label className="ct-checkbox drv-gap">
          <input type="checkbox" checked={form.markMissed} onChange={set('markMissed')} />
          <span>
            <strong>Mark this stop as missed</strong> so it is scheduled for a return trip
          </span>
        </label>
      </section>

      <button type="submit" className="ct-btn ct-btn--primary ct-btn--block">
        <Send size={16} /> Submit Issue Report
      </button>
      <button type="button" className="ct-btn ct-btn--secondary ct-btn--block" onClick={onCancel}>
        Cancel &amp; Return to Stop #{number}
      </button>
    </form>
  )
}
