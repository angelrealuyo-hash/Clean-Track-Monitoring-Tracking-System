import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, Gauge, Package, Route as RouteIcon } from 'lucide-react'
import TrackingMap from '../../components/map/TrackingMap.jsx'
import ErrorBoundary from '../../components/ErrorBoundary.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import NotAssignedCard from '../components/NotAssignedCard.jsx'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { formatTime } from '../../utils/format.js'
import { plainStopStatus } from '../../data/plainWords.js'
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
        <p className="m-eyebrow">Your route today</p>
        <div className="m-row m-row--between">
          <strong>{route.name}</strong>
          <StatusBadge tone="green">
            {summary.collected} of {summary.total} done
          </StatusBadge>
        </div>
        <p className="m-muted">{puroks.join(', ')}</p>
        <div className="ct-progress drv-gap">
          <span style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="m-muted drv-gap">{summary.percent}% of the route done</p>
      </section>

      {!r.assigned && <NotAssignedCard truckId={truck.id} />}

      <div className="m-chips" role="group" aria-label="Filter stops">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          All ({stops.length})
        </button>
        <button type="button" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>
          Not yet ({pending.length})
        </button>
        <button type="button" aria-pressed={filter === 'done'} onClick={() => setFilter('done')}>
          Done ({done.length})
        </button>
      </div>

      <section className="m-card m-card--flush">
        <div className="m-row m-row--between" style={{ padding: '8px 12px' }}>
          <strong>Map</strong>
          <StatusBadge tone="amber">Demo</StatusBadge>
        </div>
        {r.error ? (
          <p className="ct-empty">{r.error}</p>
        ) : (
          <ErrorBoundary fallback={<p className="ct-empty">The map could not load.</p>}>
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
              <Package size={10} /> Households served
            </small>
            <strong>
              {r.collectedHouseholds} / {r.totalHouseholds}
            </strong>
          </div>
        </div>
      </section>

      <div className="m-row m-row--between">
        <h2 className="m-section-title">Stops in order</h2>
        <span className="m-muted">Top to bottom</span>
      </div>

      {shown.length === 0 ? (
        <div className="m-card ct-empty">Nothing here.</div>
      ) : (
        shown.map((s) => {
          const meta = plainStopStatus[s.status]
          return (
            <article key={s.stop.id} className={`m-card drv-stop is-${s.status}`}>
              <span className="drv-stop__num">{s.number}</span>
              <div className="m-grow">
                <div className="m-row m-row--between m-row--top">
                  <div>
                    {s.status === 'next' && <StatusBadge tone="green">Go here next</StatusBadge>}
                    <strong style={{ display: 'block' }}>{s.stop.name}</strong>
                    <p className="m-muted">
                      {s.stop.purok} · about {s.stop.households} households
                    </p>
                  </div>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                </div>
                {s.log && (
                  <p className="m-muted drv-gap">
                    {s.log.status === 'collected' ? 'Done' : 'Problem reported'} at {formatTime(s.log.at)}
                  </p>
                )}
                {s.status === 'missed' && s.log?.note && <p className="drv-note">{s.log.note}</p>}
                {(s.status === 'next' || s.status === 'pending') && (
                  <Link
                    to={`/driver/collection?stop=${s.stop.id}`}
                    className={`ct-btn ${s.status === 'next' ? 'ct-btn--primary' : 'ct-btn--secondary'} ct-btn--block drv-gap`}
                  >
                    <ClipboardCheck size={15} /> Open this stop
                  </Link>
                )}
              </div>
            </article>
          )
        })
      )}

      <p className="m-muted" style={{ textAlign: 'center' }}>
        <RouteIcon size={11} /> Demo app: the map and truck location are practice data
      </p>
    </div>
  )
}
