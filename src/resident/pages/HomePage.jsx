import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Clock,
  Crosshair,
  Megaphone,
  Navigation,
  Phone,
  Route as RouteIcon,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import TrackingMap from '../../components/map/TrackingMap.jsx'
import ErrorBoundary from '../../components/ErrorBoundary.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useTruckForResident } from '../components/useTruckForResident.js'
import { notificationsForResident } from '../../store/selectors.js'
import { formatDateTime } from '../../utils/format.js'
import './ResidentPages.css'

// Short collection tip per waste type.
const tips = {
  'Biodegradable (Kitchen & Yard Waste)': 'Place segregated green bins outside your gate before the truck arrives.',
  'Recyclables (Plastics, Cartons, Metals)': 'Make sure recyclables are clean, dry and flattened.',
  'Residual Non-Recyclable Waste': 'Bag residual waste securely; no biodegradables mixed in.',
  'Hazardous & Electronic Waste (Drop-off)': 'Bring batteries and e-waste to the Barangay drop-off point.',
}

// PDF page 36
export default function HomePage() {
  const t = useTruckForResident()
  const { data, resident, route, state, progress } = t
  const truck = data.truck
  const driver = data.drivers.find((d) => d.id === truck.driverId)
  const firstName = resident.name.split(' ')[0]
  const advisory = notificationsForResident(data.notifications, resident).find((n) => n.zone)
  const street = resident.address.split(',')[0]

  return (
    <div className="m-page">
      <section className="m-card m-row">
        <span className="ct-avatar">{resident.initials}</span>
        <div className="m-grow">
          <strong>Magandang araw, {firstName}!</strong>
          <p className="m-muted">
            {resident.purok} · {street}
          </p>
        </div>
      </section>

      <section className="m-card" aria-label="Today's collection">
        <div className="m-row m-row--between">
          <StatusBadge tone={t.tone}>{t.label}</StatusBadge>
          <span className="m-muted">
            <Clock size={11} /> Simulated
          </span>
        </div>
        {t.collectionToday ? (
          <>
            <p className="m-eyebrow res-gap">Today&apos;s Collection</p>
            <h2 className="m-h2 res-waste">{t.todaysRun.wasteType}</h2>
            <dl className="m-kv res-gap">
              <dt>
                <Clock size={13} /> Scheduled Window
              </dt>
              <dd>{t.todaysRun.window}</dd>
              <dt>
                <Truck size={13} /> Assigned Truck
              </dt>
              <dd>
                {truck.id} {driver && <span className="m-muted">({driver.name})</span>}
              </dd>
              <dt>
                <RouteIcon size={13} /> Route
              </dt>
              <dd>{route.shortName}</dd>
            </dl>
            {tips[t.todaysRun.wasteType] && (
              <div className="ct-alert res-gap">
                <CircleCheck size={15} />
                <span>{tips[t.todaysRun.wasteType]}</span>
              </div>
            )}
          </>
        ) : (
          <p className="res-gap">
            No collection today ({t.today}). <Link to="/resident/schedule">See the weekly schedule</Link>.
          </p>
        )}
      </section>

      <section className="m-card m-card--flush" aria-label="Truck location">
        <div className="m-row m-row--between res-card-head">
          <strong>
            <Navigation size={14} /> Truck Live Radar
          </strong>
          <StatusBadge tone="amber">Simulated GPS</StatusBadge>
        </div>
        {t.error ? (
          <p className="ct-empty">{t.error}</p>
        ) : (
          <ErrorBoundary fallback={<p className="ct-empty">Map unavailable.</p>}>
            <TrackingMap className="m-map" route={route} state={state} progress={progress} truckLabel={truck.id} />
          </ErrorBoundary>
        )}
        <Link to="/resident/track" className="res-card-link">
          View Live Map <ArrowRight size={14} />
        </Link>
      </section>

      <h2 className="m-section-title">Quick Actions</h2>
      <div className="m-actions">
        <Link to="/resident/track" className="m-action">
          <span className="m-icon">
            <Crosshair size={16} />
          </span>
          <strong>Track Truck</strong>
          <small>Simulated live location</small>
        </Link>
        <Link to="/resident/reports/new" className="m-action">
          <span className="m-icon m-icon--red">
            <TriangleAlert size={16} />
          </span>
          <strong>Report a Problem</strong>
          <small>Missed pickup or overflow</small>
        </Link>
        <Link to="/resident/schedule" className="m-action">
          <span className="m-icon">
            <CalendarDays size={16} />
          </span>
          <strong>View Schedule</strong>
          <small>Weekly timetable</small>
        </Link>
        <Link to="/resident/profile#hotlines" className="m-action">
          <span className="m-icon">
            <Phone size={16} />
          </span>
          <strong>Barangay Hotlines</strong>
          <small>Waste office &amp; emergency</small>
        </Link>
      </div>

      {advisory && (
        <section className="m-card m-row m-row--top">
          <span className="m-icon">
            <Megaphone size={16} />
          </span>
          <div className="m-grow">
            <div className="m-row m-row--between">
              <p className="m-eyebrow">Barangay Advisory</p>
              <span className="m-muted">{formatDateTime(advisory.time)}</span>
            </div>
            <strong>{advisory.title}</strong>
            <p className="m-muted">{advisory.body}</p>
            <Link to="/resident/notifications" className="res-inline-link">
              All notifications →
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
