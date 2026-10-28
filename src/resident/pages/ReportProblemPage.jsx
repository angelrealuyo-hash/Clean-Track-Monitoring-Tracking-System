import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CircleHelp, ClipboardX, MapPin, Recycle, Send, Trash2, TriangleAlert, Truck } from 'lucide-react'
import Field from '../../components/Field.jsx'
import PhotoPicker from '../../components/PhotoPicker.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { useToast } from '../../components/toast/toastContext.js'
import { reportCategories } from '../../data/reports.js'
import { plainProblem } from '../../data/plainWords.js'
import './ResidentPages.css'

const icons = { missed: ClipboardX, 'no-truck': Truck, spillage: TriangleAlert, overflow: Trash2, other: CircleHelp }

// PDF page 38
export default function ReportProblemPage() {
  const { data, dispatch } = useData()
  const resident = useResident()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialCategory = reportCategories.some((c) => c.id === params.get('category')) ? params.get('category') : 'missed'

  const [form, setForm] = useState({
    category: initialCategory,
    location: resident.address,
    description: '',
    photo: null,
    smsUpdates: true,
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => {
    setErrors((er) => ({ ...er, [key]: undefined })) // clear the field's error as they fix it
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.location.trim().length < 5) errs.location = 'Tell us where the problem is.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (busy) return
    setBusy(true)
    const category = reportCategories.find((c) => c.id === form.category)
    const before = new Set(data.reports.map((r) => r.id))
    const res = await dispatch({
      type: 'report/add',
      payload: {
        residentId: resident.id,
        residentName: resident.name,
        residentPhone: resident.phone,
        category: form.category,
        categoryLabel: category.label,
        location: form.location.trim(),
        // Optional: a missed collection needs no explanation.
        description: form.description.trim() || `${plainProblem[form.category].label}.`,
        photo: form.photo,
        smsUpdates: form.smsUpdates,
      },
    })
    setBusy(false)
    if (!res.ok) return // the reason is shown as a message
    // The server assigns the report number.
    const created = res.data.reports.find((r) => !before.has(r.id))
    toast(`Report ${created?.id ?? ''} sent to the barangay`)
    navigate(created ? `/resident/reports/${created.id}` : '/resident/reports', { replace: true })
  }

  return (
    <form className="m-page" onSubmit={submit} noValidate>
      <header className="m-subhead">
        <Link to="/resident/reports" className="ct-icon-btn" aria-label="Back to my reports">
          <ArrowLeft size={18} />
        </Link>
        <div className="m-grow">
          <h1>Report a Problem</h1>
          <p>Tell the Barangay about a garbage problem</p>
        </div>
      </header>

      <section className="m-card m-row">
        <span className="m-icon">
          <Recycle size={16} />
        </span>
        <div className="m-grow">
          <p className="m-eyebrow">Barangay office</p>
          <p className="m-muted">Your report goes straight to the Barangay office.</p>
        </div>
      </section>

      <div className="m-row m-row--between">
        <h2 className="m-section-title">What is the problem?</h2>
        <span className="m-muted">Choose one</span>
      </div>
      <div className="ct-options" role="radiogroup" aria-label="What is the problem">
        {reportCategories.map((c) => {
          const Icon = icons[c.id]
          return (
            <label key={c.id} className="m-choice">
              <span className="m-icon">
                <Icon size={16} />
              </span>
              <span className="m-grow">
                <strong>{plainProblem[c.id].label}</strong>
                <small>{plainProblem[c.id].hint}</small>
              </span>
              <input type="radio" name="category" value={c.id} checked={form.category === c.id} onChange={set('category')} />
            </label>
          )
        })}
      </div>

      <section className="m-card">
        <h2 className="m-section-title">Tell us more</h2>
        <div className="res-gap">
          <Field label="Where?" htmlFor="rp-loc" required error={errors.location} hint="We filled in your address. Change it if needed.">
            <div className="ct-input-group">
              <MapPin size={16} />
              <input id="rp-loc" value={form.location} onChange={set('location')} aria-invalid={!!errors.location} />
            </div>
          </Field>
          <Field label="What happened? (optional)" htmlFor="rp-desc" error={errors.description}>
            <span className="res-counter">{form.description.length}/250</span>
            <textarea
              id="rp-desc"
              className="ct-input"
              maxLength={250}
              placeholder="Example: The truck passed our street this morning but did not take our trash."
              value={form.description}
              onChange={set('description')}
              aria-invalid={!!errors.description}
            />
          </Field>
          <div className="ct-field">
            <span className="ct-label">Photo (optional)</span>
            <PhotoPicker value={form.photo} onChange={(photo) => setForm((f) => ({ ...f, photo }))} />
          </div>
          <label className="ct-checkbox">
            <input type="checkbox" checked={form.smsUpdates} onChange={set('smsUpdates')} />
            Show updates about this report in my Messages
          </label>
        </div>
      </section>

      <button type="submit" className="ct-btn ct-btn--primary ct-btn--block" disabled={busy}>
        <Send size={16} /> {busy ? 'Sending…' : 'Send to Barangay'}
      </button>
      <Link to="/resident" className="ct-btn ct-btn--secondary ct-btn--block">
        Cancel
      </Link>
    </form>
  )
}
