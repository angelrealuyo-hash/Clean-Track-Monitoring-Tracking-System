import { useState } from 'react'
import {
  CircleCheck,
  ClipboardCheck,
  Download,
  Eye,
  History,
  MapPin,
  Package,
  RotateCcw,
  Search,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DetailPanel, { DetailSection } from '../components/DetailPanel.jsx'
import MarkMissedModal from '../components/MarkMissedModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useAuth } from '../../auth/authContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { currentRun, getCollectionSummary, getStopStatus, stopStatusMeta } from '../../store/selectors.js'
import { isCollectionStop, SIMULATION_LABEL } from '../../services/trackingSimulation.js'
import { downloadCsv } from '../../utils/csv.js'
import { formatTime, todayISO } from '../../utils/format.js'
import '../components/AdminPage.css'
import './CollectionMonitoringPage.css'

// PDF pages 25-26
const recordedBy = (r) => (r.byName ? `${r.byName} (${r.by})` : r.by)

export default function CollectionMonitoringPage() {
  const { data, dispatch } = useData()
  const { sessions } = useAuth()
  const { progress } = useTracking()
  const toast = useToast()
  const { route, truck, drivers } = data
  const run = currentRun(data)
  const results = run?.results ?? {}
  const adminName = sessions.admin?.name ?? 'Barangay office'
  const driver = drivers.find((d) => d.id === truck.driverId)

  const stops = route.stops.filter(isCollectionStop).map((stop) => ({
    stop,
    number: route.stops.indexOf(stop),
    status: getStopStatus(stop, progress),
    manual: results[stop.id] ?? null,
  }))
  const summary = getCollectionSummary(route, progress)
  const puroks = [...new Set(stops.map((s) => s.stop.purok))]

  const [query, setQuery] = useState('')
  const [purok, setPurok] = useState('all')
  const [status, setStatus] = useState('all')
  const [selectedId, setSelectedId] = useState(stops[0]?.stop.id ?? null)
  const [modal, setModal] = useState(null) // 'missed' | 'clearAll'

  const q = query.trim().toLowerCase()
  const visible = stops.filter(
    (s) =>
      (purok === 'all' || s.stop.purok === purok) &&
      (status === 'all' || s.status === status) &&
      (!q || s.stop.name.toLowerCase().includes(q) || s.stop.id.toLowerCase().includes(q)),
  )
  const selected = stops.find((s) => s.stop.id === selectedId) ?? null

  function exportLog() {
    downloadCsv(
      `cleantrack-collection-${todayISO()}.csv`,
      ['Stop #', 'Stop ID', 'Stop', 'Purok', 'Households', 'Status', 'Recorded by', 'Note', 'Recorded at'],
      stops.map((s) => [
        s.number,
        s.stop.id,
        s.stop.name,
        s.stop.purok,
        s.stop.households,
        stopStatusMeta[s.status].label,
        s.manual ? recordedBy(s.manual) : '',
        s.manual?.note ?? '',
        s.manual ? new Date(s.manual.at).toLocaleString('en-PH') : '',
      ]),
    )
    toast('Collection log exported')
  }

  function mark(stopId, newStatus, note) {
    dispatch({ type: 'collection/mark', payload: { stopId, status: newStatus, note, by: 'admin', byName: adminName } })
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Collection Monitoring"
        badge="Today"
        subtitle="Pickup points on today's route. Results are recorded by the driver (or here by the office)."
        actions={
          <>
            <button type="button" className="ct-btn ct-btn--secondary" onClick={exportLog}>
              <Download size={16} /> Export Log
            </button>
            <button
              type="button"
              className="ct-btn ct-btn--secondary"
              onClick={() => setModal('clearAll')}
              disabled={Object.keys(results).length === 0}
            >
              <RotateCcw size={16} /> Clear Results
            </button>
          </>
        }
      />

      <div className="ct-alert" role="status">
        <ClipboardCheck size={16} />
        {run ? (
          <span>
            Collection run <strong>{run.id}</strong> · started {formatTime(run.startedAt)} by {run.startedBy === 'driver' ? run.driverName : 'the office'}
            {run.endedAt ? ` · ended ${formatTime(run.endedAt)}` : ' · in progress'}
          </span>
        ) : (
          <span>No collection run yet today. It starts when the driver taps Start Route (or when you record a stop here).</span>
        )}
      </div>

      <section className="ct-stats" aria-label="Collection summary">
        <StatCard label="Total Stops Today" icon={MapPin} value={summary.total} unit="stops">
          <span>{route.name}</span>
        </StatCard>
        <StatCard label="Collected" icon={CircleCheck} value={summary.collected} unit="stops" highlight>
          <div className="ct-progress">
            <span style={{ width: `${summary.percent}%` }} />
          </div>
          <span>
            <b>{summary.percent}%</b> · target {data.settings.completionTarget}%
          </span>
        </StatCard>
        <StatCard label="Next Stop" icon={Truck} value={summary.next} unit="stop">
          <span>Truck heading there (simulated)</span>
        </StatCard>
        <StatCard label="Pending / Missed" icon={TriangleAlert} value={`${summary.pending} / ${summary.missed}`} tone="amber">
          <span>{summary.missed > 0 ? 'Missed stops need a return trip' : 'No missed stops'}</span>
        </StatCard>
      </section>

      <div className="ct-split">
        <article className="ct-card">
          <div className="ct-toolbar">
            <div className="ct-input-group">
              <Search size={16} />
              <input type="search" placeholder="Search stop name or ID…" aria-label="Search stops" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="ct-input" aria-label="Filter by purok" value={purok} onChange={(e) => setPurok(e.target.value)}>
              <option value="all">All puroks</option>
              {puroks.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select className="ct-input" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {['collected', 'next', 'pending', 'missed'].map((s) => (
                <option key={s} value={s}>
                  {stopStatusMeta[s].label}
                </option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="ct-empty">No stops match these filters.</p>
          ) : (
            <div className="ct-table-wrap">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th>Collection Stop</th>
                    <th>Purok</th>
                    <th>Households</th>
                    <th>Status</th>
                    <th className="is-right">View</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => (
                    <tr
                      key={s.stop.id}
                      className={`is-clickable ${s.stop.id === selectedId ? 'is-selected' : ''}`}
                      onClick={() => setSelectedId(s.stop.id)}
                    >
                      <td>
                        <strong>
                          Stop #{s.number} · {s.stop.name}
                        </strong>
                        <small className="ct-mono">{s.stop.id}</small>
                      </td>
                      <td>{s.stop.purok}</td>
                      <td>{s.stop.households}</td>
                      <td>
                        <StatusBadge tone={stopStatusMeta[s.status].tone}>{stopStatusMeta[s.status].label}</StatusBadge>
                        {s.manual && <small>by {recordedBy(s.manual)}</small>}
                      </td>
                      <td>
                        <div className="ct-table__actions">
                          <button
                            type="button"
                            className="ct-icon-btn"
                            aria-label={`View ${s.stop.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedId(s.stop.id)
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
              Showing {visible.length} of {stops.length} collection stops
            </span>
            <span>{SIMULATION_LABEL}</span>
          </div>
        </article>

        {selected ? (
          <DetailPanel
            icon={MapPin}
            title={`Stop #${selected.number} · ${selected.stop.name}`}
            subtitle={<span className="ct-mono">{selected.stop.id}</span>}
            badge={<StatusBadge tone={stopStatusMeta[selected.status].tone}>{stopStatusMeta[selected.status].label}</StatusBadge>}
            onClose={() => setSelectedId(null)}
            footer={
              <>
                <button
                  type="button"
                  className="ct-btn ct-btn--primary is-wide"
                  disabled={selected.status === 'collected'}
                  onClick={() => {
                    mark(selected.stop.id, 'collected', 'Confirmed by admin')
                    toast(`${selected.stop.name} marked as collected`)
                  }}
                >
                  <CircleCheck size={15} /> Mark as Collected
                </button>
                <button type="button" className="ct-btn ct-btn--danger" disabled={selected.status === 'missed'} onClick={() => setModal('missed')}>
                  <TriangleAlert size={15} /> Report Missed
                </button>
                <button
                  type="button"
                  className="ct-btn ct-btn--secondary"
                  disabled={!selected.manual}
                  onClick={() => {
                    dispatch({ type: 'collection/clear', payload: { stopId: selected.stop.id } }).then((res) => {
                      if (!res.ok) return
                      toast('Result cleared')
                    })
                  }}
                >
                  <RotateCcw size={15} /> Clear Result
                </button>
              </>
            }
          >
            <DetailSection icon={Truck} title="Assigned Truck & Driver">
              <dl className="ct-kv">
                <dt>Vehicle</dt>
                <dd>
                  {truck.id} · {truck.type}
                </dd>
                <dt>Driver</dt>
                <dd>{driver?.name ?? 'Unassigned'}</dd>
              </dl>
            </DetailSection>
            <DetailSection icon={Package} title="Collection Details">
              <dl className="ct-kv">
                <dt>Purok</dt>
                <dd>{selected.stop.purok}</dd>
                <dt>Households</dt>
                <dd>{selected.stop.households}</dd>
                <dt>Route order</dt>
                <dd>
                  Stop {selected.number} of {stops.length}
                </dd>
              </dl>
            </DetailSection>
            <DetailSection icon={History} title="Today's Result">
              {selected.manual ? (
                <>
                  <p>
                    <strong>{stopStatusMeta[selected.manual.status].label}</strong> · recorded by {recordedBy(selected.manual)} at{' '}
                    {formatTime(selected.manual.at)}
                  </p>
                  {selected.manual.note && <p className="collection-note">{selected.manual.note}</p>}
                </>
              ) : (
                <p>
                  <ClipboardCheck size={13} /> Not recorded yet.{' '}
                  {selected.status === 'next' ? 'The (simulated) truck is heading here.' : 'Waiting for the driver.'}
                </p>
              )}
            </DetailSection>
          </DetailPanel>
        ) : (
          <div className="ct-card ct-empty">Select a stop to see details.</div>
        )}
      </div>

      {modal === 'missed' && selected && (
        <MarkMissedModal
          stop={selected.stop}
          onClose={() => setModal(null)}
          onSave={(note) => {
            mark(selected.stop.id, 'missed', note)
            toast(`${selected.stop.name} marked as missed`, 'error')
            setModal(null)
          }}
        />
      )}
      {modal === 'clearAll' && (
        <ConfirmModal
          title="Clear Results"
          confirmLabel="Clear All"
          onClose={() => setModal(null)}
          onConfirm={() => {
            dispatch({ type: 'collection/clearAll' }).then((res) => {
              if (!res.ok) return
              toast('All results cleared')
            })
          }}
        >
          <p>Remove every Collected/Missed record of the current collection run? This also removes results the driver recorded. Use only to correct mistakes.</p>
        </ConfirmModal>
      )}
    </div>
  )
}
