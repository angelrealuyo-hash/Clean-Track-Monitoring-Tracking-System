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

// Driver "Report a Problem" at a stop (PDF page 47, right).
export default function DriverIssueForm({ stop, number, driverName, onSubmit, onCancel }) {
  const [form, setForm] = useState({ type: 'blocked', description: '', photo: null, notifyDispatch: true, markMissed: true })
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  function submit(e) {
    e.preventDefault()
    if (form.description.trim().length < 10) {
      setError('Please write a few words about what happened.')
      return
    }
    if (!form.notifyDispatch && !form.markMissed) {
      setError('Tick at least one box above.')
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
          <h1>What is the problem?</h1>
          <p>
            Stop #{number} · {stop.name}
          </p>
        </div>
      </header>

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
        <label className="ct-checkbox drv-gap">
          <input type="checkbox" checked={form.markMissed} onChange={set('markMissed')} />
          <span>
            <strong>I could not pick up here</strong> (the truck will come back later)
          </span>
        </label>
      </section>

      <button type="submit" className="ct-btn ct-btn--primary ct-btn--block">
        <Send size={16} /> Send to the Office
      </button>
      <button type="button" className="ct-btn ct-btn--secondary ct-btn--block" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
