import { useState } from 'react'
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
  Square,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import NotAssignedCard from '../components/NotAssignedCard.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { useRouteActions } from '../components/useRouteActions.js'
import { formatTime } from '../../utils/format.js'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { STATUS_TONES } from '../../services/trackingSimulation.js'
import { barangay } from '../../data/barangay.js'
import { plainTruckState, plainWaste } from '../../data/plainWords.js'
import './DriverPages.css'

// PDF page 45
export default function HomePage() {
  const r = useDriverRoute()
  const { driver, truck, route, state, summary, target, assigned } = r
  const firstName = driver.name.split(' ')[0]
  // Only notes about the next stop belong on its card.
  const dispatcherNote = target
    ? r.data.notifications.find((n) => n.audience === 'driver' && !n.read && n.link?.to.includes(target.stop.id))
    : null

  const { runActive, blocked, startRoute, endRoute } = useRouteActions(r)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const notDone = summary.pending + summary.next
  const lastRun = r.run && !runActive ? r.run : null // today's run that already ended

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
            <small>Your truck</small>
            <strong>
              <Truck size={12} /> {truck.id} ({truck.plateNumber})
            </strong>
          </div>
          <div className="m-box">
            <small>Your route</small>
            <strong>
              <RouteIcon size={12} /> {route.shortName}
            </strong>
          </div>
        </div>
      </section>

      {!assigned && <NotAssignedCard truckId={truck.id} />}

      <section className="m-card">
        <div className="m-row m-row--between">
          <strong>Today&apos;s progress</strong>
          <StatusBadge tone="green">{summary.percent}% done</StatusBadge>
        </div>
        <div className="m-row m-row--between drv-gap">
          <span className="m-big">
            {summary.collected}
            <small> of {summary.total} stops done</small>
          </span>
          <span className="m-muted">
            <strong>{r.collectedHouseholds}</strong> of {r.totalHouseholds} households
          </span>
        </div>
        <div className="ct-progress drv-gap">
          <span style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="m-muted drv-gap">
          {summary.collected} done · {notDone} to go · {summary.missed} could not pick up
        </p>
        <div className="m-box drv-gap">
          <small>Today&apos;s pickup</small>
          <strong>
            {r.todaysRun && r.todaysRun.wasteType !== 'No collection'
              ? `${plainWaste(r.todaysRun.wasteType)} · ${r.todaysRun.window}`
              : 'No pickup scheduled today'}
          </strong>
        </div>
      </section>

      {blocked && assigned && (
        <div className="ct-alert ct-alert--warning" role="alert">
          <TriangleAlert size={16} />
          <span>{blocked}</span>
        </div>
      )}

      {lastRun && (
        <div className="ct-alert" role="status">
          <Info size={16} />
          <span>
            Route ended at {formatTime(lastRun.endedAt)} and was saved. You can start another trip if needed.
          </span>
        </div>
      )}

      {assigned && (!runActive || state.status === 'idle' || state.status === 'stopped') && (
        <button type="button" className="drv-start" onClick={startRoute} disabled={Boolean(blocked)}>
          <span className="m-icon">
            <Play size={16} />
          </span>
          <span>
            {runActive ? 'Continue Route' : 'Start Route'}
            <small>{runActive ? 'Your route is still open' : 'Starts today’s collection (demo truck on the map)'}</small>
          </span>
          <ArrowRight size={18} />
        </button>
      )}

      {target ? (
        <section className="m-card drv-target">
          <div className="m-row m-row--between">
            <StatusBadge tone="green">
              <MapPin size={11} /> Next stop · #{target.number}
            </StatusBadge>
            {r.progress?.waitingAt === target.stop.id ? (
              <StatusBadge tone="green">You are here</StatusBadge>
            ) : (
              <StatusBadge tone={STATUS_TONES[state.status]}>{plainTruckState[state.status]}</StatusBadge>
            )}
          </div>
          <h2 className="m-h2">
            {target.stop.purok} · {target.stop.name}
          </h2>
          <p className="m-muted">Bags from about {target.stop.households} households</p>
          {r.progress?.waitingAt === target.stop.id && (
            <p className="drv-waiting">The truck is waiting here. Tap “Open this stop”, then “Mark as Collected”.</p>
          )}
          <div className="m-box drv-gap">
            <small>Today&apos;s trash</small>
            <strong>{plainWaste(r.todaysRun?.wasteType)}</strong>
          </div>
          {dispatcherNote && (
            <div className="ct-alert drv-gap">
              <Info size={15} />
              <span>
                <strong>Message from the office:</strong> {dispatcherNote.body}
              </span>
            </div>
          )}
          <div className="m-box-grid drv-gap">
            <Link to={`/driver/collection?stop=${target.stop.id}`} className="ct-btn ct-btn--soft">
              Open this stop
            </Link>
            {state.status === 'running' ? (
              <button type="button" className="ct-btn ct-btn--secondary" onClick={r.pause} disabled={!assigned}>
                <Pause size={15} /> Take a break
              </button>
            ) : state.status === 'paused' ? (
              <button type="button" className="ct-btn ct-btn--secondary" onClick={r.resume} disabled={!assigned}>
                <Play size={15} /> Continue
              </button>
            ) : (
              <Link to="/driver/route" className="ct-btn ct-btn--secondary">
                <Navigation size={15} /> See my route
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="m-card ct-empty">
          All stops are done for today. Great work! <Link to="/driver/route">See my route</Link>
        </section>
      )}

      {runActive && (
        <button type="button" className="ct-btn ct-btn--danger ct-btn--block" onClick={() => (notDone > 0 ? setConfirmEnd(true) : endRoute())}>
          <Square size={15} /> End Route
        </button>
      )}

      {confirmEnd && (
        <ConfirmModal title="End route now?" confirmLabel="End Route" onClose={() => setConfirmEnd(false)} onConfirm={endRoute}>
          <p>
            {notDone} stop{notDone === 1 ? ' is' : 's are'} not done yet. They will be saved as <strong>not collected</strong> for
            today.
          </p>
        </ConfirmModal>
      )}

      <div className="m-actions">
        <Link to={target ? `/driver/collection?stop=${target.stop.id}&report=1` : '/driver/collection?report=1'} className="m-action">
          <span className="m-icon m-icon--red">
            <TriangleAlert size={16} />
          </span>
          <strong>Report a Problem</strong>
          <small>Road blocked, truck problem</small>
        </Link>
        <a href={`tel:${barangay.hotline.replace(/[^\d+]/g, '')}`} className="m-action">
          <span className="m-icon">
            <Headset size={16} />
          </span>
          <strong>Call the Office</strong>
          <small>{barangay.hotline}</small>
        </a>
      </div>
      <p className="m-muted" style={{ textAlign: 'center' }}>
        Demo app: the truck location on the map is simulated.
      </p>
    </div>
  )
}
