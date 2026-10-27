import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, Clock, MapPin, MessageSquare, Plus } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { reportStatusMeta } from '../../store/selectors.js'
import { formatDateTime } from '../../utils/format.js'
import { plainProblemLabel, plainReportStatus } from '../../data/plainWords.js'
import './ResidentPages.css'

const residentStatus = plainReportStatus

// PDF page 40
export default function MyReportsPage() {
  const { data } = useData()
  const resident = useResident()
  const [filter, setFilter] = useState('all')

  const mine = data.reports
    .filter((r) => r.residentId === resident.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const count = (status) => mine.filter((r) => r.status === status).length
  const shown = filter === 'all' ? mine : mine.filter((r) => r.status === filter)

  return (
    <div className="m-page">
      <div className="m-row m-row--between">
        <div>
          <h1 className="m-h1">My Reports</h1>
          <p className="m-muted">Problems you sent to the Barangay</p>
        </div>
        <Link to="/resident/reports/new" className="ct-btn ct-btn--primary">
          <Plus size={15} /> New Report
        </Link>
      </div>

      <div className="m-chips" role="group" aria-label="Filter reports">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All ({mine.length})
        </button>
        {[
          ['submitted', 'Submitted'],
          ['in-progress', 'Reviewing'],
          ['resolved', 'Resolved'],
        ].map(([status, label]) => (
          <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)}>
            {label} ({count(status)})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="m-card ct-empty">
          <ClipboardList size={22} />
          <p>{mine.length === 0 ? 'You have not reported any problems yet.' : 'Nothing here.'}</p>
          {mine.length === 0 && (
            <Link to="/resident/reports/new" className="ct-btn ct-btn--soft">
              Report a Problem
            </Link>
          )}
        </div>
      ) : (
        shown.map((r) => {
          const [tone, label] = residentStatus[r.status] ?? ['gray', reportStatusMeta[r.status]?.label]
          return (
            <article key={r.id} className="m-card">
              <div className="m-row m-row--between">
                <strong className="ct-mono">#{r.id}</strong>
                <StatusBadge tone={tone}>{label}</StatusBadge>
              </div>
              <p className="m-muted">
                <Clock size={11} /> Sent {formatDateTime(r.submittedAt)}
              </p>
              <div className="res-gap">
                <span className="ct-tag">{plainProblemLabel(r.category)}</span>
              </div>
              <p className="res-gap">
                <MapPin size={13} /> <strong>{r.location}</strong>
              </p>
              <p className="res-report-desc">{r.description}</p>
              <div className="res-report-foot">
                <span className="m-muted">
                  {r.adminResponse ? (
                    <>
                      <MessageSquare size={12} /> Barangay replied
                    </>
                  ) : (
                    'No reply yet'
                  )}
                </span>
                <Link to={`/resident/reports/${r.id}`} className="res-inline-link">
                  See details <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}
