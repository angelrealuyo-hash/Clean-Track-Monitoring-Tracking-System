import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CircleCheck, ClipboardList, Eye, FileText, History, Inbox, MapPin, Phone, Search, TriangleAlert, User, Wrench } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DetailPanel, { DetailSection } from '../components/DetailPanel.jsx'
import ReportResponseForm from '../components/ReportResponseForm.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { reportCategories } from '../../data/reports.js'
import { reportStatusMeta } from '../../store/selectors.js'
import { formatDateTime } from '../../utils/format.js'
import '../components/AdminPage.css'
import './ResidentReportsPage.css'

const categoryLabel = Object.fromEntries(reportCategories.map((c) => [c.id, c.label]))

// Resident problem reports (sidebar item on PDF page 3; ticket view on p.39).
export default function ResidentReportsPage() {
  const { data, dispatch } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const reports = [...data.reports].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const selectedId = params.get('id') ?? reports.find((r) => r.status !== 'resolved')?.id ?? reports[0]?.id
  const select = (id) => setParams(id ? { id } : {}, { replace: true })

  const q = query.trim().toLowerCase()
  const visible = reports.filter(
    (r) =>
      (status === 'all' || r.status === status) &&
      (category === 'all' || r.category === category) &&
      (!q || [r.id, r.location, r.residentName, r.description].some((v) => v?.toLowerCase().includes(q))),
  )
  const selected = reports.find((r) => r.id === selectedId) ?? null
  const count = (s) => reports.filter((r) => r.status === s).length

  return (
    <div className="admin-page">
      <PageHeader title="Resident Reports" badge="Citizen Intake" subtitle="Problems reported by residents through the CleanTrack Resident app" />

      <section className="ct-stats" aria-label="Report summary">
        <StatCard label="Total Reports" icon={ClipboardList} value={reports.length} unit="reports">
          <span>All time (demo data)</span>
        </StatCard>
        <StatCard label="New" icon={Inbox} value={count('submitted')} unit="reports" tone="amber">
          <span>Waiting for review</span>
        </StatCard>
        <StatCard label="In Progress" icon={Wrench} value={count('in-progress')} unit="reports" highlight>
          <span>Being handled</span>
        </StatCard>
        <StatCard label="Resolved" icon={CircleCheck} value={count('resolved')} unit="reports">
          <span>
            {reports.length ? Math.round((count('resolved') / reports.length) * 100) : 0}% resolution rate
          </span>
        </StatCard>
      </section>

      <div className="ct-split">
        <article className="ct-card">
          <div className="ct-toolbar">
            <div className="ct-input-group">
              <Search size={16} />
              <input type="search" placeholder="Search ID, location, resident…" aria-label="Search reports" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="ct-input" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {Object.entries(reportStatusMeta).map(([v, m]) => (
                <option key={v} value={v}>
                  {m.label}
                </option>
              ))}
            </select>
            <select className="ct-input" aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {reportCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="ct-empty">{reports.length === 0 ? 'No resident reports yet.' : 'No reports match these filters.'}</p>
          ) : (
            <div className="ct-table-wrap">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th className="is-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className={`is-clickable ${r.id === selectedId ? 'is-selected' : ''}`} onClick={() => select(r.id)}>
                      <td>
                        <strong className="ct-mono">#{r.id}</strong>
                        <small>{formatDateTime(r.submittedAt)}</small>
                      </td>
                      <td>{categoryLabel[r.category]}</td>
                      <td>
                        {r.location}
                        <small>{r.residentName}</small>
                      </td>
                      <td>
                        <StatusBadge tone={reportStatusMeta[r.status].tone}>{reportStatusMeta[r.status].label}</StatusBadge>
                      </td>
                      <td>
                        <div className="ct-table__actions">
                          <button
                            type="button"
                            className="ct-icon-btn"
                            aria-label={`View ${r.id}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              select(r.id)
                            }}
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="ct-table__foot">
            <span>
              Showing {visible.length} of {reports.length} reports
            </span>
          </div>
        </article>

        {selected ? (
          <DetailPanel
            icon={TriangleAlert}
            title={`Report #${selected.id}`}
            subtitle={`Submitted ${formatDateTime(selected.submittedAt)}`}
            badge={<StatusBadge tone={reportStatusMeta[selected.status].tone}>{reportStatusMeta[selected.status].label}</StatusBadge>}
            onClose={() => select(null)}
          >
            <DetailSection icon={FileText} title="Ticket Information">
              <div>
                <small>Waste Category</small>
                <p>
                  <strong>{categoryLabel[selected.category]}</strong>
                </p>
              </div>
              <div>
                <small>Location</small>
                <p>
                  <MapPin size={13} /> <strong>{selected.location}</strong>
                </p>
              </div>
              <div>
                <small>Resident Reporter</small>
                <p>
                  <User size={13} /> <strong>{selected.residentName}</strong>
                  {selected.residentPhone && (
                    <span className="report-phone">
                      <Phone size={12} /> {selected.residentPhone}
                    </span>
                  )}
                </p>
              </div>
            </DetailSection>

            <DetailSection icon={FileText} title="Resident Notes">
              <p className="report-quote">“{selected.description}”</p>
            </DetailSection>

            <DetailSection icon={History} title="Activity">
              <ol className="ct-timeline">
                {selected.history.map((h, i) => (
                  <li key={i} className="is-collected">
                    <span className="ct-timeline__dot" />
                    <div>
                      <strong>{h.text}</strong>
                      <small>{formatDateTime(h.at)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            </DetailSection>

            <DetailSection icon={Wrench} title="Barangay Response">
              <ReportResponseForm
                key={selected.id}
                report={selected}
                onSave={(patch) => {
                  dispatch({ type: 'report/update', payload: { id: selected.id, ...patch } })
                  toast(`Report ${selected.id} updated · resident notified`)
                }}
              />
            </DetailSection>
          </DetailPanel>
        ) : (
          <div className="ct-card ct-empty">Select a report to see details.</div>
        )}
      </div>
    </div>
  )
}
