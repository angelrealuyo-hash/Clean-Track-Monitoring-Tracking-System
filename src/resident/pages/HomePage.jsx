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
import CollectionFeedbackCard from '../components/CollectionFeedbackCard.jsx'
import { notificationsForResident } from '../../store/selectors.js'
import { formatDateTime } from '../../utils/format.js'
import { scheduleLabel } from '../../data/schedule.js'
import Avatar from '../../components/Avatar.jsx'
import './ResidentPages.css'

// PDF page 36
export default function HomePage() {
  const t = useTruckForResident()
  const { data, resident, route, state, progress } = t
  const truck = data.truck
  const driver = data.drivers.find((d) => d.id === truck.driverId)
  const firstName = resident.name.split(' ')[0]
  const advisory = notificationsForResident(data.notifications, resident).find((n) => n.zone && n.kind !== 'pickup-check')
  const street = resident.address.split(',')[0]

  return (
    <div className="m-page">
      <section className="m-card m-row">
        <Avatar photo={resident.photo} initials={resident.initials} name={resident.name} />
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
            <Clock size={11} /> Demo
          </span>
        </div>
        {t.collectionToday ? (
          <>
            <p className="m-eyebrow res-gap">Today&apos;s pickup</p>
            <h2 className="m-h2 res-waste">Garbage pickup today</h2>
            <dl className="m-kv res-gap">
              <dt>
                <Clock size={13} /> Pickup time
              </dt>
              <dd>{t.todaysRun.window}</dd>
              <dt>
                <Truck size={13} /> Truck
              </dt>
              <dd>
                {truck.id} {driver && <span className="m-muted">({driver.name})</span>}
              </dd>
              <dt>
                <RouteIcon size={13} /> Area
              </dt>
              <dd>{route.shortName}</dd>
            </dl>
            <div className="ct-alert res-gap">
              <CircleCheck size={15} />
              <span>Tie your garbage bags well and put them out before the pickup time.</span>
            </div>
          </>
        ) : (
          <p className="res-gap">
            {t.todayException
              ? `No pickup today: ${t.todayException.reason}. `
              : `No pickup today (${t.today}). Pickup days are ${scheduleLabel}. `}
            <Link to="/resident/schedule">See the pickup days</Link>.
          </p>
        )}
      </section>

      {t.collectionToday && <CollectionFeedbackCard resident={resident} />}

      <section className="m-card m-card--flush" aria-label="Truck location">
        <div className="m-row m-row--between res-card-head">
          <strong>
            <Navigation size={14} /> Where is the truck?
          </strong>
          <StatusBadge tone="amber">Demo location</StatusBadge>
        </div>
        {t.error ? (
          <p className="ct-empty">{t.error}</p>
        ) : (
          <ErrorBoundary fallback={<p className="ct-empty">The map could not load.</p>}>
            <TrackingMap className="m-map" route={route} state={state} progress={progress} truckLabel={truck.id} />
          </ErrorBoundary>
        )}
        <Link to="/resident/track" className="res-card-link">
          See the truck on the map <ArrowRight size={14} />
        </Link>
      </section>

      <h2 className="m-section-title">What do you want to do?</h2>
      <div className="m-actions">
        <Link to="/resident/track" className="m-action">
          <span className="m-icon">
            <Crosshair size={16} />
          </span>
          <strong>See the Truck</strong>
          <small>Where it is now</small>
        </Link>
        <Link to="/resident/reports/new" className="m-action">
          <span className="m-icon m-icon--red">
            <TriangleAlert size={16} />
          </span>
          <strong>Report Missed Collection</strong>
          <small>Garbage bags not picked up</small>
        </Link>
        <Link to="/resident/schedule" className="m-action">
          <span className="m-icon">
            <CalendarDays size={16} />
          </span>
          <strong>Pickup Days</strong>
          <small>When to put out trash</small>
        </Link>
        <Link to="/resident/profile#hotlines" className="m-action">
          <span className="m-icon">
            <Phone size={16} />
          </span>
          <strong>Call for Help</strong>
          <small>Barangay &amp; emergency</small>
        </Link>
      </div>

      {advisory && (
        <section className="m-card m-row m-row--top">
          <span className="m-icon">
            <Megaphone size={16} />
          </span>
          <div className="m-grow">
            <div className="m-row m-row--between">
              <p className="m-eyebrow">Barangay announcement</p>
              <span className="m-muted">{formatDateTime(advisory.time)}</span>
            </div>
            <strong>{advisory.title}</strong>
            <p className="m-muted">{advisory.body}</p>
            <Link to="/resident/notifications" className="res-inline-link">
              See all messages →
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
