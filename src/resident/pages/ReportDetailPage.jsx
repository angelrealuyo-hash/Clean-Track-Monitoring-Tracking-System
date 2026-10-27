import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, FileText, History, MapPin, Phone, ShieldCheck, User } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { barangay } from '../../data/barangay.js'
import { formatDateTime } from '../../utils/format.js'
import { plainProblemLabel, plainReportStatus } from '../../data/plainWords.js'
import './ResidentPages.css'

const order = ['submitted', 'in-progress', 'resolved']
const residentStatus = plainReportStatus

// The history is written in office words; show it in plain words.
function plainHistory(text) {
  if (text === 'Report submitted by resident') return 'You sent this report'
  if (text === 'Barangay response updated') return 'The Barangay replied'
  const m = /^Status changed to (.+)$/.exec(text)
  if (m) return { Reviewing: 'Reviewing: the Barangay is checking it', Resolved: 'Resolved', Submitted: 'Back to Submitted' }[m[1]] ?? text
  return text
}

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
          <p>My report</p>
          <h1>{plainProblemLabel(report.category)}</h1>
        </div>
      </header>

      <section className="m-card m-card--accent">
        <StatusBadge tone={tone}>{label}</StatusBadge>
        <p className="m-muted res-gap">
          <Clock size={11} /> Sent {formatDateTime(report.submittedAt)} · Report no. {report.id}
        </p>
        <ol className="m-steps" aria-label="Progress">
          {['Submitted', 'Reviewing', 'Resolved'].map((s, i) => (
            <li key={s} className={i <= step ? 'is-done' : ''}>
              <span />
              {s}
            </li>
          ))}
        </ol>
      </section>

      <section className="m-card">
        <h2 className="m-section-title">
          <FileText size={14} /> Details
        </h2>
        <div className="res-gap" style={{ display: 'grid', gap: 8 }}>
          <div className="m-box">
            <small>Problem</small>
            <strong>{plainProblemLabel(report.category)}</strong>
          </div>
          <div className="m-box">
            <small>Where</small>
            <strong>
              <MapPin size={12} /> {report.location}
            </strong>
          </div>
          <div className="m-box">
            <small>Sent by</small>
            <strong>
              <User size={12} /> {report.residentName}
            </strong>
          </div>
          <div className="m-box">
            <small>Phone</small>
            <strong>{report.residentPhone ?? '—'}</strong> {report.smsUpdates && <span className="ct-tag">Updates in Messages</span>}
          </div>
        </div>
      </section>

      <section className="m-card">
        <h2 className="m-section-title">What you told us</h2>
        <p className="res-report-desc">“{report.description}”</p>
        {report.photo ? <img className="res-photo-full" src={report.photo} alt="Your photo" /> : <p className="m-muted">No photo.</p>}
      </section>

      <section className="m-card res-response">
        <h2 className="m-section-title">
          <ShieldCheck size={14} /> Barangay reply
        </h2>
        {report.adminResponse ? (
          <p className="res-gap">{report.adminResponse}</p>
        ) : (
          <p className="m-muted res-gap">No reply yet. We will let you know when the Barangay answers.</p>
        )}
      </section>

      <section className="m-card">
        <h2 className="m-section-title">
          <History size={14} /> What happened so far
        </h2>
        <ol className="ct-timeline res-gap">
          {report.history.map((h, i) => (
            <li key={i} className="is-collected">
              <span className="ct-timeline__dot" />
              <div>
                <strong>{plainHistory(h.text)}</strong>
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
          <strong>Call the Barangay office</strong>
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
