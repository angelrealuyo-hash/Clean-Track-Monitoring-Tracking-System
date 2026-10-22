import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Headset,
  Info,
  MapPin,
  Navigation,
  Pause,
  Play,
  Route as RouteIcon,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import NotAssignedCard from '../components/NotAssignedCard.jsx'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { STATUS_LABELS, STATUS_TONES } from '../../services/trackingSimulation.js'
import { barangay } from '../../data/barangay.js'
import './DriverPages.css'

// PDF page 45
export default function HomePage() {
  const r = useDriverRoute()
  const { driver, truck, route, state, summary, target, assigned } = r
  const firstName = driver.name.split(' ')[0]
  const routeActive = state.status === 'running' || state.status === 'paused'
  // Only notes about the next stop belong on its card.
  const dispatcherNote = target
    ? r.data.notifications.find((n) => n.audience === 'driver' && !n.read && n.link?.to.includes(target.stop.id))
    : null

  function startRoute() {
    r.start()
    if (driver.status !== 'on-shift') r.dispatch({ type: 'driver/update', payload: { id: driver.id, patch: { status: 'on-shift' } } })
  }

  return (
    <div className="m-page">
      <section className="m-card">
        <div className="m-row">
          <span className="ct-avatar">{driver.initials}</span>
          <div className="m-grow">
            <strong>Kumusta, {firstName}!</strong>
            <p className="m-muted">
              <span className="ct-mono">{driver.id}</span> · {driver.shift}
            </p>
          </div>
        </div>
        <div className="m-box-grid drv-gap">
          <div className="m-box">
            <small>Assigned Truck</small>
            <strong>
              <Truck size={12} /> {truck.id} ({truck.plateNumber})
            </strong>
          </div>
          <div className="m-box">
            <small>Route</small>
            <strong>
              <RouteIcon size={12} /> {route.shortName}
            </strong>
          </div>
        </div>
      </section>

      {!assigned && <NotAssignedCard truckId={truck.id} />}

      <section className="m-card">
        <div className="m-row m-row--between">
          <strong>Shift Progress</strong>
          <StatusBadge tone="green">{summary.percent}% completed</StatusBadge>
        </div>
        <div className="m-row m-row--between drv-gap">
          <span className="m-big">
            {summary.collected}
            <small> / {summary.total} stops</small>
          </span>
          <span className="m-muted">
            <strong>{r.collectedBins}</strong> / {r.totalBins} bins
          </span>
        </div>
        <div className="ct-progress drv-gap">
          <span style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="m-muted drv-gap">
          {summary.collected} cleared · {summary.pending + summary.next} pending · {summary.missed} missed
        </p>
      </section>

      {assigned && !routeActive && state.status !== 'completed' && (
        <button type="button" className="drv-start" onClick={startRoute}>
          <span className="m-icon">
            <Play size={16} />
          </span>
          <span>
            {state.status === 'stopped' ? 'Restart Route' : 'Start Route'}
            <small>Begins the simulated GPS for {truck.id}</small>
          </span>
          <ArrowRight size={18} />
        </button>
      )}

      {target ? (
        <section className="m-card drv-target">
          <div className="m-row m-row--between">
            <StatusBadge tone="green">
              <MapPin size={11} /> Next Target · Stop #{target.number}
            </StatusBadge>
            <StatusBadge tone={STATUS_TONES[state.status]}>{STATUS_LABELS[state.status]}</StatusBadge>
          </div>
          <h2 className="m-h2">
            {target.stop.purok} · {target.stop.name}
          </h2>
          <p className="m-muted">{target.stop.bins} bins at this stop</p>
          <div className="m-box drv-gap">
            <small>Waste Stream Today</small>
            <strong>{r.todaysRun?.wasteType ?? '—'}</strong>
          </div>
          {dispatcherNote && (
            <div className="ct-alert drv-gap">
              <Info size={15} />
              <span>
                <strong>Dispatcher:</strong> {dispatcherNote.body}
              </span>
            </div>
          )}
          <div className="m-box-grid drv-gap">
            <Link to={`/driver/collection?stop=${target.stop.id}`} className="ct-btn ct-btn--soft">
              Open Stop
            </Link>
            {state.status === 'running' ? (
              <button type="button" className="ct-btn ct-btn--secondary" onClick={r.pause} disabled={!assigned}>
                <Pause size={15} /> Pause Route
              </button>
            ) : state.status === 'paused' ? (
              <button type="button" className="ct-btn ct-btn--secondary" onClick={r.resume} disabled={!assigned}>
                <Play size={15} /> Resume Route
              </button>
            ) : (
              <Link to="/driver/route" className="ct-btn ct-btn--secondary">
                <Navigation size={15} /> My Route
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="m-card ct-empty">
          All stops are done for today. Great work! <Link to="/driver/route">See route summary</Link>
        </section>
      )}

      <div className="m-actions">
        <Link to={target ? `/driver/collection?stop=${target.stop.id}&report=1` : '/driver/collection?report=1'} className="m-action">
          <span className="m-icon m-icon--red">
            <TriangleAlert size={16} />
          </span>
          <strong>Report Issue</strong>
          <small>Roadblock / spill / truck</small>
        </Link>
        <a href={`tel:${barangay.hotline.replace(/[^\d+]/g, '')}`} className="m-action">
          <span className="m-icon">
            <Headset size={16} />
          </span>
          <strong>Call Dispatch</strong>
          <small>{barangay.hotline}</small>
        </a>
      </div>
      <p className="m-muted" style={{ textAlign: 'center' }}>
        Truck position is simulated (no GPS device connected).
      </p>
    </div>
  )
}
