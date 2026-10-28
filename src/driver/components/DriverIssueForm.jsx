import { useState } from 'react'
import { ArrowLeft, Ban, CircleHelp, PackageX, Send, ShieldAlert, Trash2, Wrench } from 'lucide-react'
import Field from '../../components/Field.jsx'
import PhotoPicker from '../../components/PhotoPicker.jsx'

const issueTypes = [
  { id: 'blocked', label: 'Road is blocked', hint: 'Cannot get the truck in', icon: Ban },
  { id: 'overflow', label: 'Too much trash or spill', hint: 'Dumped trash or a big mess', icon: Trash2 },
  { id: 'bin', label: 'Bags torn or scattered', hint: 'Animals tore the bags, trash on road', icon: PackageX },
  { id: 'truck', label: 'Truck problem', hint: 'Flat tire, lift not working', icon: Wrench },
  { id: 'safety', label: 'Danger here', hint: 'Angry dog, live wire', icon: ShieldAlert },
  { id: 'other', label: 'Something else', hint: 'Any other problem', icon: CircleHelp },
]

// Driver "Report a Problem" (from Home or from a stop in My Route).
// stops: [{ stop, number, status }] to choose from; stopId: preselected stop or ''.
// Every report is saved for the office (Collection Monitoring).
export default function DriverIssueForm({ stops, stopId = '', driverName, saving = false, onSubmit, onCancel }) {
  const [form, setForm] = useState({ stopId, type: 'blocked', description: '', photo: null, notifyDispatch: true, markMissed: false })
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const chosen = stops.find((s) => s.stop.id === form.stopId) ?? null
  // "Could not pick up here" only makes sense for a stop that is not done yet.
  const canMarkMissed = Boolean(chosen && (chosen.status === 'pending' || chosen.status === 'next'))

  function submit(e) {
    e.preventDefault()
    if (saving) return
    if (form.description.trim().length < 10) {
      setError('Please write a few words about what happened.')
      return
    }
    const type = issueTypes.find((t) => t.id === form.type)
    onSubmit({
      stopId: chosen?.stop.id ?? null,
      stopName: chosen?.stop.name ?? null,
      issueType: type.id,
      issueLabel: type.label,
      description: form.description.trim(),
      photo: form.photo,
      notifyDispatch: form.notifyDispatch,
      markMissed: canMarkMissed && form.markMissed,
      driverName,
    })
  }

  return (
    <form className="m-page" onSubmit={submit} noValidate>
      <header className="m-subhead">
        <button type="button" className="ct-icon-btn" onClick={onCancel} aria-label="Go back">
          <ArrowLeft size={18} />
        </button>
        <div className="m-grow">
          <h1>Report a Problem</h1>
          <p>The office will see this report.</p>
        </div>
      </header>

      <label className="ct-field">
        <span className="ct-label">Where?</span>
        <select className="ct-input" value={form.stopId} onChange={set('stopId')}>
          <option value="">Not at a stop (on the road, truck, depot)</option>
          {stops.map((s) => (
            <option key={s.stop.id} value={s.stop.id}>
              Stop #{s.number} · {s.stop.name}
            </option>
          ))}
        </select>
      </label>

      <div className="m-row m-row--between">
        <h2 className="m-section-title">Choose one</h2>
        <span className="m-muted">Required</span>
      </div>
      <div className="m-choice-grid" role="radiogroup" aria-label="What is the problem">
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
        <Field label="What happened?" htmlFor="di-desc" required error={error} hint={`${form.description.length}/250`}>
          <textarea
            id="di-desc"
            className="ct-input"
            maxLength={250}
            placeholder="Example: A parked van is blocking the street, I cannot reach the garbage bags."
            value={form.description}
            onChange={(e) => {
              setError('')
              set('description')(e)
            }}
            aria-invalid={!!error}
          />
        </Field>
        <div className="ct-field">
          <span className="ct-label">Photo (optional)</span>
          <PhotoPicker value={form.photo} onChange={(photo) => setForm((f) => ({ ...f, photo }))} />
        </div>
        <label className="ct-checkbox">
          <input type="checkbox" checked={form.notifyDispatch} onChange={set('notifyDispatch')} />
          <span>
            <strong>Tell the office now</strong> (they will get an urgent message)
          </span>
        </label>
        {canMarkMissed && (
          <label className="ct-checkbox drv-gap">
            <input type="checkbox" checked={form.markMissed} onChange={set('markMissed')} />
            <span>
              <strong>I could not pick up at this stop</strong> (saved as “Could not pick up”)
            </span>
          </label>
        )}
      </section>

      <button type="submit" className="ct-btn ct-btn--primary ct-btn--block" disabled={saving}>
        <Send size={16} /> {saving ? 'Sending…' : 'Send to the Office'}
      </button>
      <button type="button" className="ct-btn ct-btn--secondary ct-btn--block" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
