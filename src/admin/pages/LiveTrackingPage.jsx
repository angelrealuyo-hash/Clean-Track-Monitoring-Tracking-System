import { useState } from 'react'
import { Crosshair, Gauge, Maximize2, Phone, Route as RouteIcon, Truck } from 'lucide-react'
import TrackingMap from '../../components/map/TrackingMap.jsx'
import MapLegend from '../../components/map/MapLegend.jsx'
import ErrorBoundary from '../../components/ErrorBoundary.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import SimulationControls from '../components/SimulationControls.jsx'
import RouteProgressModal from '../components/RouteProgressModal.jsx'
import LocationLogCard from '../components/LocationLogCard.jsx'
import { useTracking } from '../../tracking/trackingContext.js'
import { STATUS_LABELS, STATUS_TONES } from '../../services/trackingSimulation.js'
import { useData } from '../../store/dataContext.js'
import { formatCoords, formatTime } from '../../utils/format.js'
import '../components/AdminPage.css'
import './LiveTrackingPage.css'

// PDF pages 8-11 (Track, Live Tracking, View Route)
export default function LiveTrackingPage() {
  const { route, state, progress, error, tickMs } = useTracking()
  const { data } = useData()
  const { truck } = data
  const driver = data.drivers.find((d) => d.id === truck.driverId)
  const [routeOpen, setRouteOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState(null)

  const focus = (type) => setFocusRequest({ type, id: Date.now() })
  const waitingStop = progress?.waitingAt ? route.stops.find((s) => s.id === progress.waitingAt) : null
  const statusBadge = waitingStop ? (
    <StatusBadge tone="amber">Waiting at stop</StatusBadge>
  ) : (
    <StatusBadge tone={STATUS_TONES[state.status]}>{STATUS_LABELS[state.status]}</StatusBadge>
  )
  // Current stop: where the truck is standing (or waiting). Next stop: the
  // next pickup point not yet recorded.
  const atStop = state.step === 0 && state.legIndex > 0 && state.status !== 'idle'
  const currentStop = waitingStop ?? (atStop ? route.stops[state.legIndex] : null)
  const fromIndex = currentStop ? route.stops.indexOf(currentStop) : state.legIndex
  const nextStop = route.stops.slice(fromIndex + 1).find((s) => s.households > 0 && !['collected', 'missed'].includes(progress?.statusOf(s)))

  return (
    <div className="admin-page lt-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">
            Fleet Operations / <b>Live Tracking</b>
          </p>
          <h1>Live Tracking</h1>
        </div>
        <div className="admin-page__actions">
          <StatusBadge tone="amber">SIMULATED GPS — DEMO MODE</StatusBadge>
          <SimulationControls />
        </div>
      </header>

      {waitingStop && (
        <div className="ct-alert" role="status">
          <span>
            The demo truck is waiting at <strong>{waitingStop.name}</strong> until the driver (or the office, in
            Collection Monitoring) records this pickup point as collected or missed.
          </span>
        </div>
      )}

      {!route.coordinatesVerified && (
        <div className="ct-alert ct-alert--warning">
          <span>
            <strong>Demo route:</strong> stop positions are illustrative and are not verified locations in
            the barangay. The truck position is simulated, not real GPS.
          </span>
        </div>
      )}

      {error ? (
        <div className="ct-card ct-empty">
          <strong>No route to show.</strong>
          <br />
          {error}
        </div>
      ) : (
        <div className="lt-body">
          {/* Truck list (one truck for this barangay) */}
          <aside className="ct-card lt-list" aria-label="Trucks">
            <div className="lt-list__head">
              <strong>Trucks</strong>
              <span className="ct-tag">1 registered</span>
            </div>
            <div className="lt-truck is-selected">
              <div className="lt-truck__row">
                <strong>{truck.id}</strong>
                {statusBadge}
                <span className="lt-truck__speed">{state.speedKmh} km/h</span>
              </div>
              <small>
                {truck.type} · {truck.plateNumber}
              </small>
              <div className="lt-truck__meta">
                <span>{driver?.name ?? 'Driver unassigned'}</span>
                <span>{route.shortName}</span>
              </div>
              <small className="lt-truck__updated">
                {state.updatedAt ? `Updated ${formatTime(state.updatedAt)} (simulated)` : 'Waiting for simulation'}
              </small>
            </div>
            <p className="lt-list__foot">
              {progress.collected} of {progress.total} stops collected
            </p>
          </aside>

          <section className="ct-card lt-map-area">
            <ErrorBoundary
              fallback={
                <div className="ct-empty lt-map">
                  The map could not be displayed. Try refreshing the page.
                </div>
              }
            >
              <TrackingMap
                className="lt-map"
                route={route}
                state={state}
                progress={progress}
                focusRequest={focusRequest}
                truckLabel={truck.id}
              />
            </ErrorBoundary>

            {state.status === 'idle' && (
              <div className="lt-map-hint" role="status">
                Simulation not started. Press <strong>Start Simulation</strong> to move {truck.id} along the
                demo route.
              </div>
            )}

            <div className="lt-map-tools">
              <button type="button" className="ct-btn ct-btn--secondary" onClick={() => focus('truck')}>
                <Crosshair size={15} /> Center on Truck
              </button>
              <button type="button" className="ct-btn ct-btn--secondary" onClick={() => focus('route')}>
                <Maximize2 size={15} /> Whole Route
              </button>
            </div>

            <MapLegend className="lt-legend" />

            {/* Truck detail card (PDF page 9, bottom right) */}
            <article
              className="ct-card lt-detail"
              aria-label={`${truck.id} details`}
              data-leg={state.legIndex}
              data-step={state.step}
            >
              <header className="lt-detail__head">
                <span className="ct-logo" style={{ width: 36, height: 36 }}>
                  <Truck size={18} />
                </span>
                <div>
                  <strong>
                    {truck.id} <span className="ct-mono">{truck.plateNumber}</span>
                  </strong>
                  <small>{truck.type} (Barangay Truck)</small>
                </div>
                {statusBadge}
              </header>

              <div className="lt-detail__driver">
                <span className="admin-avatar admin-avatar--small">{driver?.initials ?? '—'}</span>
                <div>
                  <strong>{driver?.name ?? 'Unassigned'}</strong>
                  <small>Assigned Driver</small>
                </div>
                {driver && (
                  <span className="lt-detail__phone">
                    <Phone size={13} /> {driver.phone}
                  </span>
                )}
              </div>

              <div className="lt-detail__grid">
                <div>
                  <small>Assigned Route</small>
                  <strong>{route.shortName}</strong>
                </div>
                <div>
                  <small>Current Speed</small>
                  <strong>
                    <Gauge size={14} /> {state.speedKmh} km/h
                  </strong>
                </div>
              </div>

              <dl className="ct-kv lt-detail__kv">
                <dt>GPS Source</dt>
                <dd className="lt-amber">Simulated location (demo mode)</dd>
                <dt>Position</dt>
                <dd className="ct-mono" data-testid="truck-position">
                  {formatCoords(state.position)}
                </dd>
                <dt>Current stop</dt>
                <dd>{currentStop?.name ?? (state.status === 'idle' ? 'At the depot' : 'Driving')}</dd>
                <dt>Next stop</dt>
                <dd>{nextStop?.name ?? '—'}</dd>
                <dt>Last update</dt>
                <dd>{formatTime(state.updatedAt)}</dd>
              </dl>

              <div className="lt-detail__progress">
                <div>
                  <span>Collection Progress</span>
                  <strong>
                    {progress.percent}% ({progress.collected} / {progress.total} stops)
                  </strong>
                </div>
                <div className="ct-progress">
                  <span style={{ width: `${progress.percent}%` }} />
                </div>
              </div>

              <div className="lt-detail__actions">
                <button type="button" className="ct-btn ct-btn--primary" onClick={() => setRouteOpen(true)}>
                  <RouteIcon size={15} /> View Route
                </button>
                <button type="button" className="ct-btn ct-btn--secondary" onClick={() => focus('truck')}>
                  <Crosshair size={15} /> Center on Map
                </button>
              </div>
            </article>
          </section>
        </div>
      )}

      {!error && <LocationLogCard refreshKey={`${data.simulation.status}-${data.activeRunId}-${progress?.collected}-${progress?.waitingAt}`} />}

      <footer className="lt-statusbar">
        <span>● Simulated GPS · updates every {tickMs / 1000}s</span>
        <span>{route.coordinatesVerified ? 'Verified route coordinates' : 'Demo route · coordinates not verified'}</span>
        <span>Map data © OpenStreetMap contributors</span>
      </footer>

      {routeOpen && <RouteProgressModal truckId={truck.id} onClose={() => setRouteOpen(false)} />}
    </div>
  )
}
