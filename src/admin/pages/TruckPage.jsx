import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRightLeft,
  CalendarClock,
  CircleCheck,
  Gauge,
  Info,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Route as RouteIcon,
  Trash2,
  Truck,
  UserPlus,
  Wrench,
} from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DetailPanel, { DetailSection } from '../components/DetailPanel.jsx'
import TruckFormModal from '../components/truck/TruckFormModal.jsx'
import AssignDriverModal from '../components/truck/AssignDriverModal.jsx'
import LogMaintenanceModal from '../components/truck/LogMaintenanceModal.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { truckStatusMeta } from '../../store/selectors.js'
import { RESERVE_STATUSES, SERVICE_STATUSES, allTrucks, truckDeleteBlock } from '../../data/truck.js'
import { STATUS_LABELS } from '../../services/trackingSimulation.js'
import { formatDate } from '../../utils/format.js'
import '../components/AdminPage.css'
import './TruckPage.css'

// PDF pages 12-17. The barangay's trucks: one SERVICE truck runs the
// collection route (Live Tracking, Driver app, shift roster), and any other
// registered trucks are RESERVE trucks. A reserve truck can be made the
// service truck, e.g. while the usual truck is under maintenance.
export default function TruckPage() {
  const { data, dispatch } = useData()
  const { state: sim } = useTracking()
  const toast = useToast()
  // { kind: 'add' | 'edit' | 'assign' | 'maintenance' | 'delete' | 'service', truckId }
  const [modal, setModal] = useState(null)
  const [selectedId, setSelectedId] = useState(data.truck.id)

  const { drivers, route } = data
  const service = data.truck
  const trucks = allTrucks(data)
  // Falls back to the service truck when the selected one was deleted.
  const truck = trucks.find((t) => t.id === selectedId) ?? service
  const isService = truck.id === service.id
  const statusesFor = (t) => (t.id === service.id ? SERVICE_STATUSES : RESERVE_STATUSES)
  const driverOf = (t) => (t.id === service.id ? drivers.find((d) => d.id === t.driverId) : null)
  const driver = driverOf(truck)
  const status = truckStatusMeta[truck.status] ?? truckStatusMeta.active
  const lastService = truck.maintenance?.[0]
  const maintenance = truck.maintenance ?? []
  const reserveCount = trucks.length - 1
  const routeBusy = Boolean(data.activeRunId) || sim.status === 'running' || sim.status === 'paused'

  const open = (kind, t = truck) => setModal({ kind, truckId: t.id })
  const close = () => setModal(null)
  const target = modal && trucks.find((t) => t.id === modal.truckId)
  const run = (action, message, after) =>
    dispatch(action).then((res) => {
      if (!res.ok) return
      toast(message)
      after?.()
      close()
    })

  const serviceBlock = (t) => {
    if (t.id === service.id) return null
    if (t.status !== 'active') return `Set ${t.id} to Active first.`
    if (routeBusy) return 'End the route and stop the simulated truck first.'
    return null
  }

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow={<>Fleet Operations / <b>Truck Management</b></>}
        title="Truck Management"
        subtitle="The barangay's registered garbage collection trucks"
        actions={
          <>
            <button type="button" className="ct-btn ct-btn--secondary" onClick={() => open('maintenance')}>
              <Wrench size={16} /> Log Maintenance
            </button>
            <button type="button" className="ct-btn ct-btn--primary" onClick={() => setModal({ kind: 'add' })}>
              <Plus size={16} /> Add Truck
            </button>
          </>
        }
      />

      <section className="ct-stats" aria-label="Truck summary">
        <StatCard label="Registered Trucks" icon={Truck} value={trucks.length} unit={trucks.length === 1 ? 'truck' : 'trucks'}>
          <span>
            <b>{service.id}</b> on the route{reserveCount > 0 && <> · {reserveCount} reserve</>}
          </span>
        </StatCard>
        <StatCard label="Vehicle Status" icon={CircleCheck} value={status.label} highlight tone={truck.status === 'active' ? 'green' : 'amber'}>
          <span>
            <b>{truck.id}</b> · set by the barangay office
          </span>
        </StatCard>
        <StatCard label="Odometer" icon={Gauge} value={(truck.odometerKm ?? 0).toLocaleString()} unit="km">
          <span>
            <b>{truck.id}</b> · updated when maintenance is logged
          </span>
        </StatCard>
        <StatCard label="Next Service" icon={CalendarClock} value={formatDate(truck.nextServiceDate)}>
          <span>Last: {lastService ? formatDate(lastService.date) : 'none recorded'}</span>
        </StatCard>
      </section>

      <div className="ct-split">
        <div className="truck-main">
          <article className="ct-card">
            <div className="ct-table-wrap">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th>Truck ID / Plate</th>
                    <th>Vehicle Type</th>
                    <th>Assigned Driver</th>
                    <th>Assignment</th>
                    <th>Status</th>
                    <th className="is-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((t) => {
                    const d = driverOf(t)
                    const meta = truckStatusMeta[t.status] ?? truckStatusMeta.active
                    const deleteBlock = truckDeleteBlock(data, t)
                    return (
                      <tr
                        key={t.id}
                        className={`is-clickable ${t.id === truck.id ? 'is-selected' : ''}`}
                        onClick={() => setSelectedId(t.id)}
                        tabIndex={0}
                        aria-label={`Show ${t.id} details`}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedId(t.id)
                          }
                        }}
                      >
                        <td>
                          <div className="ct-person">
                            <Truck size={18} color="var(--ct-green-900)" />
                            <span>
                              <strong>{t.id}</strong>
                              <small className="ct-mono">{t.plateNumber}</small>
                            </span>
                          </div>
                        </td>
                        <td>{t.type}</td>
                        <td>
                          {d ? (
                            <div className="ct-person">
                              <span className="ct-avatar">{d.initials}</span>
                              {d.name}
                            </div>
                          ) : (
                            <em className="truck-muted">{t.id === service.id ? 'Unassigned' : '—'}</em>
                          )}
                        </td>
                        <td>{t.id === service.id ? <span className="truck-role is-service">Service truck</span> : <span className="ct-tag">Reserve</span>}</td>
                        <td>
                          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                        </td>
                        <td>
                          <div className="ct-table__actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            <button type="button" className="ct-icon-btn" aria-label={`Edit ${t.id}`} title="Edit vehicle" onClick={() => open('edit', t)}>
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="ct-icon-btn truck-delete"
                              aria-label={`Delete ${t.id}`}
                              title={deleteBlock ?? 'Delete truck'}
                              disabled={Boolean(deleteBlock)}
                              onClick={() => open('delete', t)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="ct-table__foot">
              <span>
                Showing <strong>{trucks.length}</strong> registered barangay {trucks.length === 1 ? 'truck' : 'trucks'}
              </span>
              <span>
                <Info size={12} /> Only the service truck runs the route
              </span>
            </div>
          </article>

          <article className="ct-card">
            <div className="ct-card__header">
              <div>
                <h2>Maintenance History · {truck.id}</h2>
                <p>{maintenance.length} record(s)</p>
              </div>
            </div>
            <div className="ct-card__body">
              {maintenance.length === 0 ? (
                <p className="ct-empty">No maintenance has been logged yet.</p>
              ) : (
                <div className="ct-table-wrap">
                  <table className="ct-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Service</th>
                        <th>Odometer</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenance.map((m, i) => (
                        <tr key={`${m.date}-${i}`}>
                          <td>{formatDate(m.date)}</td>
                          <td>{m.type}</td>
                          <td>{m.odometerKm ? `${m.odometerKm.toLocaleString()} km` : '—'}</td>
                          <td>{m.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </article>
        </div>

        <div id="truck-details">
          <DetailPanel
            icon={Truck}
            title={`${truck.id} · ${truck.plateNumber}`}
            subtitle={`${truck.type} · ${isService ? 'Service truck' : 'Reserve truck'}`}
            badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
            footer={
              <>
                <button type="button" className="ct-btn ct-btn--secondary" onClick={() => open('edit')}>
                  <Pencil size={15} /> Edit Vehicle
                </button>
                {isService ? (
                  <button type="button" className="ct-btn ct-btn--secondary" onClick={() => open('assign')}>
                    <UserPlus size={15} /> Assign Driver
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ct-btn ct-btn--secondary"
                    onClick={() => open('service')}
                    disabled={Boolean(serviceBlock(truck))}
                    title={serviceBlock(truck) ?? `Put ${truck.id} on the route`}
                  >
                    <ArrowRightLeft size={15} /> Make Service Truck
                  </button>
                )}
                <button type="button" className="ct-btn ct-btn--primary is-wide" onClick={() => open('maintenance')}>
                  <Wrench size={15} /> Log Maintenance
                </button>
              </>
            }
          >
            <DetailSection icon={Info} title="Vehicle Information">
              <dl className="ct-kv">
                <dt>Compaction Capacity</dt>
                <dd>{truck.capacityTons} metric tons</dd>
                <dt>Fuel / Power Type</dt>
                <dd>{truck.fuel}</dd>
                <dt>Odometer Reading</dt>
                <dd>{(truck.odometerKm ?? 0).toLocaleString()} km</dd>
                <dt>Year &amp; Model</dt>
                <dd>{truck.model || '—'}</dd>
              </dl>
            </DetailSection>

            <DetailSection icon={RouteIcon} title="Operational Details">
              <div>
                <small>Assigned Driver</small>
                {driver ? (
                  <div className="truck-driver">
                    <span className="ct-avatar">{driver.initials}</span>
                    <strong>{driver.name}</strong>
                    <span className="truck-phone">
                      <Phone size={12} /> {driver.phone}
                    </span>
                  </div>
                ) : (
                  <p>
                    <em>{isService ? 'Unassigned' : 'None (reserve truck)'}</em>
                  </p>
                )}
              </div>
              <div>
                <small>Assigned Route</small>
                <p>{isService ? <strong>{route.name}</strong> : <em>Not on the route</em>}</p>
              </div>
              {isService ? (
                <div>
                  <small>Current Location (simulated)</small>
                  <p>
                    <MapPin size={13} /> {STATUS_LABELS[sim.status]} · <Link to="/admin/live-tracking">Open Live Tracking</Link>
                  </p>
                </div>
              ) : (
                <div>
                  <small>Collection Runs</small>
                  <p>{(data.runs ?? []).filter((r) => r.truckId === truck.id).length} saved run(s)</p>
                </div>
              )}
            </DetailSection>

            <DetailSection icon={Wrench} title="Maintenance">
              <dl className="ct-kv">
                <dt>Last Maintenance</dt>
                <dd>{lastService ? formatDate(lastService.date) : '—'}</dd>
                <dt>Next Scheduled Service</dt>
                <dd className="truck-amber">{formatDate(truck.nextServiceDate)}</dd>
              </dl>
              {lastService && (
                <p className="truck-last">
                  <CircleCheck size={14} /> {lastService.type}
                  {lastService.notes && <small>{lastService.notes}</small>}
                </p>
              )}
            </DetailSection>
          </DetailPanel>
        </div>
      </div>

      {modal?.kind === 'add' && (
        <TruckFormModal
          trucks={trucks}
          statuses={RESERVE_STATUSES}
          onClose={close}
          onSave={(form) => run({ type: 'truck/add', payload: form }, `${form.id} added as a reserve truck`, () => setSelectedId(form.id))}
        />
      )}
      {modal?.kind === 'edit' && target && (
        <TruckFormModal
          truck={target}
          trucks={trucks}
          statuses={statusesFor(target)}
          onClose={close}
          onSave={(patch) => run({ type: 'truck/update', payload: patch }, `${target.id} updated`)}
        />
      )}
      {modal?.kind === 'assign' && (
        <AssignDriverModal
          truck={service}
          drivers={drivers}
          onClose={close}
          onSave={(driverId) => {
            const name = drivers.find((d) => d.id === driverId)?.name
            run({ type: 'truck/assignDriver', payload: { driverId } }, name ? `${name} assigned to ${service.id}` : `${service.id} has no driver now`)
          }}
        />
      )}
      {modal?.kind === 'maintenance' && target && (
        <LogMaintenanceModal
          truck={target}
          statuses={statusesFor(target)}
          onClose={close}
          onSave={(record) => run({ type: 'truck/logMaintenance', payload: { ...record, truckId: target.id } }, `Maintenance logged for ${target.id}`)}
        />
      )}
      {modal?.kind === 'delete' && target && (
        <ConfirmModal
          title={`Delete ${target.id}?`}
          confirmLabel="Delete Truck"
          onClose={close}
          onConfirm={() => run({ type: 'truck/delete', payload: { id: target.id } }, `${target.id} deleted`)}
        >
          <p>
            <strong>
              {target.id} · {target.plateNumber}
            </strong>{' '}
            and its {(target.maintenance ?? []).length} maintenance record(s) will be removed. This cannot be undone.
          </p>
          <p className="truck-muted">To keep the record, set the truck to Inactive instead.</p>
        </ConfirmModal>
      )}
      {modal?.kind === 'service' && target && (
        <Modal
          title={`Make ${target.id} the service truck?`}
          icon={ArrowRightLeft}
          onClose={close}
          footer={
            <>
              <button type="button" className="ct-btn ct-btn--secondary" onClick={close}>
                Cancel
              </button>
              <button
                type="button"
                className="ct-btn ct-btn--primary"
                onClick={() => run({ type: 'truck/setService', payload: { id: target.id } }, `${target.id} is now the service truck`)}
              >
                Make Service Truck
              </button>
            </>
          }
        >
          <p>
            <strong>{target.id}</strong> will run <strong>{route.name}</strong> and show on Live Tracking and in the Driver app.
          </p>
          <ul className="truck-swap-list">
            <li>
              The driver on duty{drivers.find((d) => d.id === service.driverId) ? ` (${drivers.find((d) => d.id === service.driverId).name})` : ''} and
              the Morning/Afternoon shift collectors move to {target.id}.
            </li>
            <li>
              {service.id} becomes a reserve truck with no driver. Its records and maintenance history are kept.
            </li>
          </ul>
        </Modal>
      )}
    </div>
  )
}
