import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CircleCheck,
  ClipboardCheck,
  Contact,
  MapPin,
  TriangleAlert,
  Truck,
} from 'lucide-react'
import TrackingMap from '../../components/map/TrackingMap.jsx'
import MapLegend from '../../components/map/MapLegend.jsx'
import ErrorBoundary from '../../components/ErrorBoundary.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import StatCard from '../components/StatCard.jsx'
import { useTracking } from '../../tracking/trackingContext.js'
import { STATUS_LABELS, STATUS_TONES, isCollectionStop } from '../../services/trackingSimulation.js'
import { reportCategories } from '../../data/reports.js'
import { useData } from '../../store/dataContext.js'
import { getCollectionSummary, getStopStatus, stopStatusMeta } from '../../store/selectors.js'
import { formatDateTime, formatTime, todayName } from '../../utils/format.js'
import '../components/AdminPage.css'
import './DashboardPage.css'

const categoryLabel = Object.fromEntries(reportCategories.map((c) => [c.id, c.label]))

// What the truck card says for each simulation status.
const truckStatusText = {
  idle: 'At depot · simulation not started',
  running: 'On route (simulated)',
  paused: 'Paused on route (simulated)',
  stopped: 'Simulation stopped',
  completed: 'Route finished · back at depot',
}

// PDF pages 3-4
export default function DashboardPage() {
  const { route, state, progress, error } = useTracking()
  const { data } = useData()
  const { truck, drivers, collectionLog } = data
  const driver = drivers.find((d) => d.id === truck.driverId)
  const onShift = drivers.filter((d) => d.status === 'on-shift').length
  const standby = drivers.filter((d) => d.status === 'standby').length
  const openReports = data.reports.filter((r) => r.status !== 'resolved')
  const recentActivity = data.notifications.filter((n) => n.audience === 'admin').slice(0, 3)
  const summary = error ? null : getCollectionSummary(route, progress, collectionLog)
  const today = todayName()
  const todaysRun = data.weeklySchedule.find((d) => d.day === today)

  return (
    <div className="admin-page dashboard">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">
            Barangay Operations Hub · <b>Puroks 1 to 6</b> · <span className="ct-tag">Demo data</span>
          </p>
          <h1>Barangay Waste Management &amp; Truck Tracking</h1>
        </div>
        <div className="admin-page__actions">
          <div className="dashboard__sync">
            <StatusBadge tone={STATUS_TONES[state.status]}>Simulation: {STATUS_LABELS[state.status]}</StatusBadge>
            <small>Last update: {formatTime(state.updatedAt)}</small>
          </div>
          <Link to="/admin/live-tracking" className="ct-btn ct-btn--primary">
            <MapPin size={16} /> Open Live Tracking
          </Link>
        </div>
      </header>

      {/* Summary cards */}
      <section className="dashboard__stats" aria-label="Summary">
        <StatCard label="Registered Truck" icon={Truck} value="1" unit="Truck">
          <span>
            <b>{truck.id}</b> · {truck.type}
          </span>
          <span>{truckStatusText[state.status]}</span>
        </StatCard>

        <StatCard label="Drivers" icon={Contact} value={drivers.length} unit="Drivers">
          <span>
            <b>{onShift} on shift</b> · {standby} standby
          </span>
          <span>Assigned: {driver?.name ?? 'None'}</span>
        </StatCard>

        <StatCard
          label="Collection Progress"
          icon={ClipboardCheck}
          value={error ? '—' : `${summary.collected} / ${summary.total}`}
          unit="Stops"
          highlight
        >
          <div className="ct-progress">
            <span style={{ width: `${summary?.percent ?? 0}%` }} />
          </div>
          <span>
            <b>{summary?.percent ?? 0}%</b> collected · target {data.settings.completionTarget}%
            {summary?.missed > 0 && <> · <b className="is-red">{summary.missed} missed</b></>}
          </span>
        </StatCard>

        <StatCard label="Open Resident Reports" icon={TriangleAlert} value={openReports.length} unit="Reports" tone="amber">
          <span className="dashboard__chips">
            {openReports.map((r) => (
              <span key={r.id} className="ct-tag">
                {r.status === 'in-progress' ? 'In progress' : 'New'}
              </span>
            ))}
          </span>
        </StatCard>
      </section>

      <section className="dashboard__row">
        {/* Map */}
        <article className="ct-card dashboard__map-card">
          <div className="ct-card__header">
            <div>
              <h2>Collection Route &amp; Truck Map</h2>
              <p>Simulated truck position on the demo route</p>
            </div>
            <StatusBadge tone="amber">SIMULATED GPS</StatusBadge>
          </div>
          <div className="ct-card__body">
            {error ? (
              <p className="ct-empty">{error}</p>
            ) : (
              <ErrorBoundary fallback={<p className="ct-empty">The map could not be displayed.</p>}>
                <TrackingMap
                  className="dashboard__map"
                  route={route}
                  state={state}
                  progress={progress}
                  truckLabel={truck.id}
                />
              </ErrorBoundary>
            )}
            <div className="dashboard__map-foot">
              <MapLegend />
              {state.status === 'idle' && (
                <span>
                  Simulation not started. <Link to="/admin/live-tracking">Start it in Live Tracking</Link>
                </span>
              )}
            </div>
          </div>
        </article>

        {/* Needs attention */}
        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Needs Attention</h2>
              <p>Open resident reports</p>
            </div>
            <StatusBadge tone={openReports.length ? 'red' : 'green'}>{openReports.length} open</StatusBadge>
          </div>
          <div className="ct-card__body">
            {openReports.length === 0 ? (
              <p className="ct-empty">
                <CircleCheck size={18} /> No open reports.
              </p>
            ) : (
              <ul className="dashboard__attention">
                {openReports.map((r) => (
                  <li key={r.id} className={r.status === 'in-progress' ? 'is-progress' : 'is-new'}>
                    <div className="dashboard__attention-top">
                      <strong>{categoryLabel[r.category]}</strong>
                      <small>{formatDateTime(r.submittedAt)}</small>
                    </div>
                    <span className="ct-mono">#{r.id}</span>
                    <p>{r.location}</p>
                    <Link to={`/admin/resident-reports?id=${r.id}`} className="ct-btn ct-btn--soft">
                      Review Report <ArrowRight size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard__row">
        {/* Route, schedule and stop status */}
        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Today&apos;s Route &amp; Schedule</h2>
              <p>{today}</p>
            </div>
            <Link to="/admin/collection" className="ct-link-btn">
              Collection Monitoring →
            </Link>
          </div>
          <div className="ct-card__body dashboard__route">
            <dl className="ct-kv">
              <dt>Route</dt>
              <dd>{route.name}</dd>
              <dt>Truck / Driver</dt>
              <dd>
                {truck.id} · {driver?.name ?? 'Unassigned'}
              </dd>
              <dt>Start time</dt>
              <dd>{route.startTime}</dd>
              <dt>Today&apos;s collection</dt>
              <dd>{todaysRun?.wasteType ?? 'No collection'}</dd>
              <dt>Time window</dt>
              <dd>{todaysRun?.window ?? '—'}</dd>
            </dl>

            <div>
              <h3 className="dashboard__subhead">Collection Status</h3>
              {error ? (
                <p className="ct-empty">No stops to show.</p>
              ) : (
                <ul className="dashboard__stops">
                  {route.stops.filter(isCollectionStop).map((stop) => {
                    const { tone, label } = stopStatusMeta[getStopStatus(stop, progress, collectionLog)]
                    return (
                      <li key={stop.id}>
                        <span>
                          <strong>{stop.name}</strong>
                          <small>{stop.purok}</small>
                        </span>
                        <StatusBadge tone={tone}>{label}</StatusBadge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </article>

        {/* Recent activity */}
        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest admin notifications (sample data)</p>
            </div>
          </div>
          <div className="ct-card__body">
            {recentActivity.length === 0 ? (
              <p className="ct-empty">No recent activity.</p>
            ) : (
              <ul className="dashboard__activity">
                {recentActivity.map((n) => (
                  <li key={n.id}>
                    <span className={`dashboard__dot is-${n.priority}`} />
                    <div>
                      <strong>{n.title}</strong>
                      <p>{n.body}</p>
                      <small>{formatDateTime(n.time)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/admin/notifications" className="ct-link-btn">
              View all notifications →
            </Link>
          </div>
        </article>
      </section>
    </div>
  )
}
