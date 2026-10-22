import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, Gauge, Package, Route as RouteIcon } from 'lucide-react'
import TrackingMap from '../../components/map/TrackingMap.jsx'
import ErrorBoundary from '../../components/ErrorBoundary.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import NotAssignedCard from '../components/NotAssignedCard.jsx'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { stopStatusMeta } from '../../store/selectors.js'
import { formatTime } from '../../utils/format.js'
import './DriverPages.css'

// PDF page 46
export default function MyRoutePage() {
  const r = useDriverRoute()
  const { route, state, progress, stops, summary, truck } = r
  const [filter, setFilter] = useState('all')
  const done = stops.filter((s) => s.status === 'collected' || s.status === 'missed')
  const pending = stops.filter((s) => s.status === 'pending' || s.status === 'next')
  const shown = filter === 'all' ? stops : filter === 'pending' ? pending : done
  const puroks = [...new Set(stops.map((s) => s.stop.purok))]

  return (
    <div className="m-page">
      <section className="m-card">
        <p className="m-eyebrow">Assigned Sector</p>
        <div className="m-row m-row--between">
          <strong>{route.name}</strong>
          <StatusBadge tone="green">
            {summary.collected}/{summary.total} stops
          </StatusBadge>
        </div>
        <p className="m-muted">{puroks.join(', ')}</p>
        <div className="ct-progress drv-gap">
          <span style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="m-muted drv-gap">{summary.percent}% route completed</p>
      </section>

      {!r.assigned && <NotAssignedCard truckId={truck.id} />}

      <div className="m-chips" role="group" aria-label="Filter stops">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All Stops ({stops.length})
        </button>
        <button type="button" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>
          Pending ({pending.length})
        </button>
        <button type="button" aria-pressed={filter === 'done'} onClick={() => setFilter('done')}>
          Completed ({done.length})
        </button>
      </div>

      <section className="m-card m-card--flush">
        <div className="m-row m-row--between" style={{ padding: '8px 12px' }}>
          <strong>Route Map</strong>
          <StatusBadge tone="amber">Simulated</StatusBadge>
        </div>
        {r.error ? (
          <p className="ct-empty">{r.error}</p>
        ) : (
          <ErrorBoundary fallback={<p className="ct-empty">Map unavailable.</p>}>
            <TrackingMap className="m-map" route={route} state={state} progress={progress} truckLabel={truck.id} />
          </ErrorBoundary>
        )}
        <div className="m-box-grid" style={{ padding: 10 }}>
          <div className="m-box">
            <small>
              <Gauge size={10} /> Speed
            </small>
            <strong>{state.speedKmh} km/h</strong>
          </div>
          <div className="m-box">
            <small>
              <Package size={10} /> Bins collected
            </small>
            <strong>
              {r.collectedBins} / {r.totalBins}
            </strong>
          </div>
        </div>
      </section>

      <div className="m-row m-row--between">
        <h2 className="m-section-title">Sequence Itinerary</h2>
        <span className="m-muted">Driving order</span>
      </div>

      {shown.length === 0 ? (
        <div className="m-card ct-empty">No stops in this filter.</div>
      ) : (
        shown.map((s) => {
          const meta = stopStatusMeta[s.status]
          return (
            <article key={s.stop.id} className={`m-card drv-stop is-${s.status}`}>
              <span className="drv-stop__num">{s.number}</span>
              <div className="m-grow">
                <div className="m-row m-row--between m-row--top">
                  <div>
                    {s.status === 'next' && <StatusBadge tone="green">Next Target</StatusBadge>}
                    <strong style={{ display: 'block' }}>{s.stop.name}</strong>
                    <p className="m-muted">
                      {s.stop.purok} · {s.stop.bins} bins
                    </p>
                  </div>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </div>
                {s.log && (
                  <p className="m-muted drv-gap">
                    {s.log.status === 'collected' ? 'Logged' : 'Reported'} at {formatTime(s.log.at)}
                  </p>
                )}
                {s.status === 'missed' && s.log?.note && <p className="drv-note">{s.log.note}</p>}
                {(s.status === 'next' || s.status === 'pending') && (
                  <Link
                    to={`/driver/collection?stop=${s.stop.id}`}
                    className={`ct-btn ${s.status === 'next' ? 'ct-btn--primary' : 'ct-btn--secondary'} ct-btn--block drv-gap`}
                  >
                    <ClipboardCheck size={15} /> Open Stop &amp; Log Bins
                  </Link>
                )}
              </div>
            </article>
          )
        })
      )}

      <p className="m-muted" style={{ textAlign: 'center' }}>
        <RouteIcon size={11} /> Simulated route map · demo coordinates
      </p>
    </div>
  )
}
