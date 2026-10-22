import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, FileText, History, MapPin, Phone, ShieldCheck, User } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { reportCategories } from '../../data/reports.js'
import { barangay } from '../../data/barangay.js'
import { formatDateTime } from '../../utils/format.js'
import './ResidentPages.css'

const categoryLabel = Object.fromEntries(reportCategories.map((c) => [c.id, c.label]))
const order = ['submitted', 'in-progress', 'resolved']
const residentStatus = { submitted: ['amber', 'Under review'], 'in-progress': ['blue', 'In progress'], resolved: ['green', 'Resolved'] }

// PDF page 39 (Ticket dossier)
export default function ReportDetailPage() {
  const { reportId } = useParams()
  const { data } = useData()
  const resident = useResident()
  const report = data.reports.find((r) => r.id === reportId && r.residentId === resident.id)

  if (!report) {
    return (
      <div className="m-page">
        <div className="m-card ct-empty">
          <p>We couldn&apos;t find report {reportId} in your reports.</p>
          <Link to="/resident/reports" className="ct-btn ct-btn--soft">
            Back to My Reports
          </Link>
        </div>
      </div>
    )
  }

  const step = order.indexOf(report.status)
  const [tone, label] = residentStatus[report.status]

  return (
    <div className="m-page">
      <header className="m-subhead">
        <Link to="/resident/reports" className="ct-icon-btn" aria-label="Back to my reports">
          <ArrowLeft size={18} />
        </Link>
        <div className="m-grow">
          <p>Ticket Dossier</p>
          <h1>Report #{report.id}</h1>
        </div>
      </header>

      <section className="m-card m-card--accent">
        <StatusBadge tone={tone}>{label}</StatusBadge>
        <p className="m-muted res-gap">
          <Clock size={11} /> Submitted {formatDateTime(report.submittedAt)}
        </p>
        <ol className="m-steps" aria-label="Progress">
          {['Logged', 'In progress', 'Resolved'].map((s, i) => (
            <li key={s} className={i <= step ? 'is-done' : ''}>
              <span />
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="m-card">
        <h2 className="m-section-title">
          <FileText size={14} /> Ticket Information
        </h2>
        <div className="res-gap" style={{ display: 'grid', gap: 8 }}>
          <div className="m-box">
            <small>Category</small>
            <strong>{categoryLabel[report.category]}</strong>
          </div>
          <div className="m-box">
            <small>Location</small>
            <strong>
              <MapPin size={12} /> {report.location}
            </strong>
          </div>
          <div className="m-box">
            <small>Resident Reporter</small>
            <strong>
              <User size={12} /> {report.residentName}
            </strong>
          </div>
          <div className="m-box">
            <small>Contact</small>
            <strong>{report.residentPhone ?? '—'}</strong> {report.smsUpdates && <span className="ct-tag">Updates on</span>}
          </div>
        </div>
      </section>

      <section className="m-card">
        <h2 className="m-section-title">Description &amp; Evidence</h2>
        <p className="res-report-desc">“{report.description}”</p>
        {report.photo ? <img className="res-photo-full" src={report.photo} alt="Photo attached to this report" /> : <p className="m-muted">No photo attached.</p>}
      </section>

      <section className="m-card res-response">
        <h2 className="m-section-title">
          <ShieldCheck size={14} /> Barangay Response
        </h2>
        {report.adminResponse ? (
          <p className="res-gap">{report.adminResponse}</p>
        ) : (
          <p className="m-muted res-gap">The barangay office has not replied yet. You will get a notification when they do.</p>
        )}
      </section>

      <section className="m-card">
        <h2 className="m-section-title">
          <History size={14} /> Activity
        </h2>
        <ol className="ct-timeline res-gap">
          {report.history.map((h, i) => (
            <li key={i} className="is-collected">
              <span className="ct-timeline__dot" />
              <div>
                <strong>{h.text}</strong>
                <small>{formatDateTime(h.at)}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="m-card m-row">
        <span className="m-icon">
          <Phone size={16} />
        </span>
        <div className="m-grow">
          <strong>Barangay Solid Waste Desk</strong>
          <p className="m-muted">{barangay.hotline}</p>
        </div>
        <a className="ct-btn ct-btn--soft" href={`tel:${barangay.hotline.replace(/[^\d+]/g, '')}`}>
          Call
        </a>
      </section>

      <Link to="/resident/reports" className="ct-btn ct-btn--secondary ct-btn--block">
        <ArrowLeft size={15} /> Back to My Reports
      </Link>
    </div>
  )
}
