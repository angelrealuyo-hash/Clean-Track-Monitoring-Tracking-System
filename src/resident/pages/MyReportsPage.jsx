import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, Clock, MapPin, MessageSquare, Plus } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { reportCategories } from '../../data/reports.js'
import { reportStatusMeta } from '../../store/selectors.js'
import { formatDateTime } from '../../utils/format.js'
import './ResidentPages.css'

const categoryLabel = Object.fromEntries(reportCategories.map((c) => [c.id, c.label]))
const residentStatus = { submitted: ['amber', 'Under review'], 'in-progress': ['blue', 'In progress'], resolved: ['green', 'Resolved'] }

// PDF page 40
export default function MyReportsPage() {
  const { data } = useData()
  const resident = useResident()
  const [filter, setFilter] = useState('all')

  const mine = data.reports
    .filter((r) => r.residentId === resident.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const active = mine.filter((r) => r.status !== 'resolved')
  const shown = filter === 'all' ? mine : filter === 'active' ? active : mine.filter((r) => r.status === 'resolved')

  return (
    <div className="m-page">
      <div className="m-row m-row--between">
        <div>
          <h1 className="m-h1">My Submitted Reports</h1>
          <p className="m-muted">Track your filed barangay concerns</p>
        </div>
        <Link to="/resident/reports/new" className="ct-btn ct-btn--primary">
          <Plus size={15} /> New Report
        </Link>
      </div>

      <div className="m-chips" role="group" aria-label="Filter reports">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All Reports ({mine.length})
        </button>
        <button type="button" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>
          Active ({active.length})
        </button>
        <button type="button" aria-pressed={filter === 'resolved'} onClick={() => setFilter('resolved')}>
          Resolved ({mine.length - active.length})
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="m-card ct-empty">
          <ClipboardList size={22} />
          <p>{mine.length === 0 ? 'You have not reported any problems yet.' : 'No reports in this filter.'}</p>
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
                <Clock size={11} /> Submitted {formatDateTime(r.submittedAt)}
              </p>
              <div className="res-gap">
                <span className="ct-tag">{categoryLabel[r.category]}</span>
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
                    'Waiting for barangay response'
                  )}
                </span>
                <Link to={`/resident/reports/${r.id}`} className="res-inline-link">
                  View Details <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}
