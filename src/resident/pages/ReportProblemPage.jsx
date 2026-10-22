import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CircleHelp, ClipboardX, MapPin, Recycle, Send, Trash2, TriangleAlert, Truck } from 'lucide-react'
import Field from '../../components/Field.jsx'
import PhotoPicker from '../../components/PhotoPicker.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { useToast } from '../../components/toast/toastContext.js'
import { reportCategories } from '../../data/reports.js'
import { nextId } from '../../store/dataReducer.js'
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
  const set = (key) => (e) => {
    setErrors((er) => ({ ...er, [key]: undefined })) // clear the field's error as they fix it
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (form.location.trim().length < 5) errs.location = 'Tell us where the problem is.'
    if (form.description.trim().length < 10) errs.description = 'Describe what happened (at least 10 characters).'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const id = nextId(`REP-${new Date().getFullYear()}`, data.reports, 3)
    const category = reportCategories.find((c) => c.id === form.category)
    dispatch({
      type: 'report/add',
      payload: {
        id,
        residentId: resident.id,
        residentName: resident.name,
        residentPhone: resident.phone,
        category: form.category,
        categoryLabel: category.label,
        location: form.location.trim(),
        description: form.description.trim(),
        photo: form.photo,
        smsUpdates: form.smsUpdates,
      },
    })
    toast(`Report ${id} sent to the barangay`)
    navigate(`/resident/reports/${id}`, { replace: true })
  }

  return (
    <form className="m-page" onSubmit={submit} noValidate>
      <header className="m-subhead">
        <Link to="/resident/reports" className="ct-icon-btn" aria-label="Back to my reports">
          <ArrowLeft size={18} />
        </Link>
        <div className="m-grow">
          <h1>Report a Problem</h1>
          <p>Solid waste concern for the barangay</p>
        </div>
      </header>

      <section className="m-card m-row">
        <span className="m-icon">
          <Recycle size={16} />
        </span>
        <div className="m-grow">
          <p className="m-eyebrow">{data.settings.barangayName}</p>
          <p className="m-muted">Reports go straight to the barangay solid waste office.</p>
        </div>
      </section>

      <div className="m-row m-row--between">
        <h2 className="m-section-title">Select Incident Category</h2>
        <span className="m-muted">Required *</span>
      </div>
      <div className="ct-options" role="radiogroup" aria-label="Incident category">
        {reportCategories.map((c) => {
          const Icon = icons[c.id]
          return (
            <label key={c.id} className="m-choice">
              <span className="m-icon">
                <Icon size={16} />
              </span>
              <span className="m-grow">
                <strong>{c.label}</strong>
                <small>{c.hint}</small>
              </span>
              <input type="radio" name="category" value={c.id} checked={form.category === c.id} onChange={set('category')} />
            </label>
          )
        })}
      </div>

      <section className="m-card">
        <h2 className="m-section-title">Incident Details</h2>
        <div className="res-gap">
          <Field label="Location" htmlFor="rp-loc" required error={errors.location} hint="Filled in from your profile; change it if needed.">
            <div className="ct-input-group">
              <MapPin size={16} />
              <input id="rp-loc" value={form.location} onChange={set('location')} aria-invalid={!!errors.location} />
            </div>
          </Field>
          <Field label="Description" htmlFor="rp-desc" required error={errors.description}>
            <span className="res-counter">{form.description.length}/250</span>
            <textarea
              id="rp-desc"
              className="ct-input"
              maxLength={250}
              placeholder="e.g. The truck passed our corner at 8:30 AM without collecting our green bin."
              value={form.description}
              onChange={set('description')}
              aria-invalid={!!errors.description}
            />
          </Field>
          <div className="ct-field">
            <span className="ct-label">Evidence Photo (optional)</span>
            <PhotoPicker value={form.photo} onChange={(photo) => setForm((f) => ({ ...f, photo }))} />
          </div>
          <label className="ct-checkbox">
            <input type="checkbox" checked={form.smsUpdates} onChange={set('smsUpdates')} />
            Send me updates on this report ({resident.phone})
          </label>
        </div>
      </section>

      <button type="submit" className="ct-btn ct-btn--primary ct-btn--block">
        <Send size={16} /> Submit Report to Barangay
      </button>
      <Link to="/resident" className="ct-btn ct-btn--secondary ct-btn--block">
        Cancel &amp; Return to Home
      </Link>
    </form>
  )
}
