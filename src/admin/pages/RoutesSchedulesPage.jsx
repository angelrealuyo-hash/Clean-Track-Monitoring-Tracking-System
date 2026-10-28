import { useState } from 'react'
import ScheduleExceptionsCard from '../components/routes/ScheduleExceptionsCard.jsx'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, CalendarDays, Clock, MapPin, MapPinPlus, Package, Pencil, Route as RouteIcon, Trash2, Truck, TriangleAlert } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DetailPanel, { DetailSection } from '../components/DetailPanel.jsx'
import EditRouteModal from '../components/routes/EditRouteModal.jsx'
import EditStopModal from '../components/routes/EditStopModal.jsx'
import EditScheduleModal from '../components/routes/EditScheduleModal.jsx'
import AddStopModal from '../components/routes/AddStopModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { stopStatusMeta } from '../../store/selectors.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { STATUS_LABELS, STATUS_TONES, isCollectionStop } from '../../services/trackingSimulation.js'
import { barangay } from '../../data/barangay.js'
import { todayName } from '../../utils/format.js'
import { isCollectionDay, scheduleLabel } from '../../data/schedule.js'
import '../components/AdminPage.css'
import './RoutesSchedulesPage.css'

// PDF pages 21-24. One route, driven by the barangay's one truck.
export default function RoutesSchedulesPage() {
  const { data, dispatch } = useData()
  const { state: sim, progress } = useTracking()
  const toast = useToast()
  const [modal, setModal] = useState(null) // { type: 'route' } | { type: 'stop', stop, number } | { type: 'day', entry }

  const { route, truck, drivers, weeklySchedule } = data
  const driver = drivers.find((d) => d.id === truck.driverId)
  const collectionStops = route.stops.filter(isCollectionStop)
  const totalHouseholds = collectionStops.reduce((n, s) => n + s.households, 0)
  const puroks = [...new Set(collectionStops.map((s) => s.purok))]
  const collectionDays = weeklySchedule.filter((d) => isCollectionDay(d.day)).length
  const simRunning = sim.status === 'running' || sim.status === 'paused'
  const today = todayName()
  const close = () => setModal(null)

  return (
    <div className="admin-page">
      <PageHeader
        title="Routes & Schedules"
        badge="Barangay Operations"
        subtitle="Collection route, stop order, and the weekly collection timetable"
        actions={
          <button type="button" className="ct-btn ct-btn--primary" onClick={() => setModal({ type: 'route' })}>
            <Pencil size={16} /> Edit Route
          </button>
        }
      />

      <section className="ct-stats" aria-label="Route summary">
        <StatCard label="Collection Stops" icon={MapPin} value={collectionStops.length} unit="stops">
          <span>Covering {puroks.join(', ')}</span>
        </StatCard>
        <StatCard label="Households Served" icon={Package} value={totalHouseholds} unit="households">
          <span>Sum of all stops</span>
        </StatCard>
        <StatCard label="Daily Start" icon={Clock} value={route.startTime} highlight>
          <span>Departs {route.stops[0]?.name}</span>
        </StatCard>
        <StatCard label="Collection Days" icon={CalendarDays} value={collectionDays} unit="days / week">
          <span>{scheduleLabel} · today {isCollectionDay(today) ? 'is a collection day' : 'no collection'}</span>
        </StatCard>
      </section>

      <div className="ct-split">
        <div className="routes-main">
          <article className="ct-card">
            <div className="ct-card__header">
              <div>
                <h2>Collection Stops Sequence</h2>
                <p>Driving order for {truck.id}. Depots stay first and last.</p>
              </div>
              <button type="button" className="ct-btn ct-btn--soft routes-add" onClick={() => setModal({ type: 'add' })}>
                <MapPinPlus size={15} /> Add Pickup Point
              </button>
              {!route.coordinatesVerified && (
                <StatusBadge tone="amber">Demo coordinates</StatusBadge>
              )}
            </div>
            <div className="ct-card__body">
              <div className="ct-table-wrap">
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Stop</th>
                      <th>Purok</th>
                      <th>Households</th>
                      <th>Today</th>
                      <th className="is-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {route.stops.map((stop, i) => {
                      const st = progress ? progress.statusOf(stop) : 'pending'
                      return (
                        <tr key={stop.id}>
                          <td className="ct-mono">{i + 1}</td>
                          <td>
                            <strong>{stop.name}</strong>
                            <small className="ct-mono">{stop.id}</small>
                          </td>
                          <td>{stop.purok}</td>
                          <td>{isCollectionStop(stop) ? stop.households : '—'}</td>
                          <td>
                            {st === 'depot' ? (
                              <span className="ct-tag">Depot</span>
                            ) : (
                              <StatusBadge tone={stopStatusMeta[st].tone}>{stopStatusMeta[st].label}</StatusBadge>
                            )}
                          </td>
                          <td>
                            <div className="ct-table__actions">
                              {isCollectionStop(stop) && (
                                <>
                                  <button
                                    type="button"
                                    className="ct-icon-btn"
                                    aria-label={`Move ${stop.name} up`}
                                    disabled={i <= 1}
                                    onClick={() => dispatch({ type: 'route/moveStop', payload: { id: stop.id, dir: -1 } })}
                                  >
                                    <ArrowUp size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    className="ct-icon-btn"
                                    aria-label={`Move ${stop.name} down`}
                                    disabled={i >= route.stops.length - 2}
                                    onClick={() => dispatch({ type: 'route/moveStop', payload: { id: stop.id, dir: 1 } })}
                                  >
                                    <ArrowDown size={16} />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="ct-icon-btn"
                                aria-label={`Edit ${stop.name}`}
                                onClick={() => setModal({ type: 'stop', stop, number: i + 1 })}
                              >
                                <Pencil size={16} />
                              </button>
                              {isCollectionStop(stop) && (
                                <button
                                  type="button"
                                  className="ct-icon-btn"
                                  aria-label={`Remove ${stop.name}`}
                                  disabled={collectionStops.length <= 1}
                                  onClick={() => setModal({ type: 'remove', stop })}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          <article className="ct-card">
            <div className="ct-card__header">
              <div>
                <h2>Weekly Collection Schedule</h2>
                <p>Official collection days: {scheduleLabel} only. You can change their pickup times. Residents and the driver see this.</p>
              </div>
            </div>
            <div className="ct-card__body">
              <div className="ct-table-wrap">
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Collection</th>
                      <th>Time Window</th>
                      <th className="is-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklySchedule.map((entry) => (
                      <tr key={entry.day} className={entry.day === today ? 'is-selected' : ''}>
                        <td>
                          <strong>{entry.day}</strong>
                          {entry.day === today && <small>Today</small>}
                        </td>
                        <td>{isCollectionDay(entry.day) ? <StatusBadge tone="green">Collection day</StatusBadge> : <span className="ct-tag">No collection</span>}</td>
                        <td>{entry.window}</td>
                        <td>
                          <div className="ct-table__actions">
                            {isCollectionDay(entry.day) ? (
                              <button
                                type="button"
                                className="ct-icon-btn"
                                aria-label={`Edit ${entry.day}`}
                                onClick={() => setModal({ type: 'day', entry })}
                              >
                                <Pencil size={16} />
                              </button>
                            ) : (
                              <small>Not a collection day</small>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </article>

          <ScheduleExceptionsCard />
        </div>

        <DetailPanel
          icon={RouteIcon}
          title={route.name}
          subtitle={<span className="ct-mono">{route.id}</span>}
          badge={<StatusBadge tone={STATUS_TONES[sim.status]}>{STATUS_LABELS[sim.status]}</StatusBadge>}
          footer={
            <>
              <button type="button" className="ct-btn ct-btn--secondary" onClick={() => setModal({ type: 'route' })}>
                <Pencil size={15} /> Edit Route
              </button>
              <Link to="/admin/live-tracking" className="ct-btn ct-btn--primary">
                <MapPin size={15} /> View on Map
              </Link>
            </>
          }
        >
          <DetailSection icon={RouteIcon} title="Route Overview">
            <div>
              <small>Collection Area</small>
              <p>
                <strong>
                  {puroks.join(', ')}
                </strong>
              </p>
            </div>
            <div>
              <small>Shift Timetable</small>
              <p>
                <strong>Starts {route.startTime}</strong> · {collectionDays} collection days per week
              </p>
            </div>
            <div>
              <small>Map Coordinates</small>
              <p>
                {route.coordinatesVerified ? (
                  <StatusBadge tone="green">Verified</StatusBadge>
                ) : (
                  <StatusBadge tone="amber">Demo only, not verified</StatusBadge>
                )}
              </p>
            </div>
          </DetailSection>

          <DetailSection icon={Truck} title="Assigned Fleet">
            <dl className="ct-kv">
              <dt>Vehicle</dt>
              <dd>
                {truck.id} · {truck.plateNumber}
              </dd>
              <dt>Driver</dt>
              <dd>{driver?.name ?? 'Unassigned'}</dd>
            </dl>
            <p>
              <Link to="/admin/truck">Change truck driver →</Link>
            </p>
          </DetailSection>

          <DetailSection icon={MapPin} title="Collection Progress (simulated)">
            <div className="routes-progress">
              <span>
                {progress?.collected ?? 0} of {progress?.total ?? 0} stops
              </span>
              <strong>{progress?.percent ?? 0}%</strong>
            </div>
            <div className="ct-progress">
              <span style={{ width: `${progress?.percent ?? 0}%` }} />
            </div>
          </DetailSection>

          {!driver && (
            <div className="ct-alert ct-alert--warning" style={{ marginTop: 14 }}>
              <TriangleAlert size={16} /> The truck has no driver assigned.
            </div>
          )}
        </DetailPanel>
      </div>

      {modal?.type === 'route' && (
        <EditRouteModal
          route={route}
          simRunning={simRunning}
          onClose={close}
          onSave={(patch) => {
            dispatch({ type: 'route/update', payload: patch }).then((res) => {
              if (!res.ok) return
              toast('Route saved')
              close()
            })
          }}
        />
      )}
      {modal?.type === 'stop' && (
        <EditStopModal
          stop={modal.stop}
          number={modal.number}
          puroks={barangay.puroks}
          simRunning={simRunning}
          onClose={close}
          onSave={(patch) => {
            dispatch({ type: 'route/updateStop', payload: { id: modal.stop.id, patch } }).then((res) => {
              if (!res.ok) return
              toast(`Stop ${modal.number} saved`)
              close()
            })
          }}
        />
      )}
      {modal?.type === 'add' && (
        <AddStopModal
          route={route}
          puroks={barangay.puroks}
          onClose={close}
          onSave={(stop) => {
            dispatch({ type: 'route/addStop', payload: stop }).then((res) => {
              if (!res.ok) return
              toast(`${stop.name} added to the route`)
              close()
            })
          }}
        />
      )}
      {modal?.type === 'remove' && (
        <ConfirmModal
          title="Remove Pickup Point"
          confirmLabel="Remove"
          onClose={close}
          onConfirm={() => {
            dispatch({ type: 'route/removeStop', payload: { id: modal.stop.id } }).then((res) => {
              if (!res.ok) return
              toast(`${modal.stop.name} removed`)
            })
          }}
        >
          <p>
            Remove <strong>{modal.stop.name}</strong> from the route? Past collection records keep their copy of this stop.
          </p>
          {simRunning && <div className="ct-alert ct-alert--warning">This restarts the running demo truck from the depot.</div>}
        </ConfirmModal>
      )}
      {modal?.type === 'day' && (
        <EditScheduleModal
          entry={modal.entry}
          onClose={close}
          onSave={(patch) => {
            dispatch({ type: 'schedule/update', payload: { day: modal.entry.day, patch } }).then((res) => {
              if (!res.ok) return
              toast(`${modal.entry.day} schedule saved`)
              close()
            })
          }}
        />
      )}
    </div>
  )
}
