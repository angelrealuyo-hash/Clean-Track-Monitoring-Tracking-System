import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CircleCheck,
  Gauge,
  Info,
  MapPin,
  Pencil,
  Phone,
  Route as RouteIcon,
  Truck,
  UserPlus,
  Wrench,
} from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DetailPanel, { DetailSection } from '../components/DetailPanel.jsx'
import EditTruckModal from '../components/truck/EditTruckModal.jsx'
import AssignDriverModal from '../components/truck/AssignDriverModal.jsx'
import LogMaintenanceModal from '../components/truck/LogMaintenanceModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useTracking } from '../../tracking/trackingContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { truckStatusMeta } from '../../store/selectors.js'
import { STATUS_LABELS } from '../../services/trackingSimulation.js'
import { formatDate } from '../../utils/format.js'
import '../components/AdminPage.css'
import './TruckPage.css'

// PDF pages 12-17. CleanTrack serves one barangay with one truck, so this
// screen manages that truck (no add/delete of extra fleet vehicles).
export default function TruckPage() {
  const { data, dispatch } = useData()
  const { state: sim } = useTracking()
  const toast = useToast()
  const [modal, setModal] = useState(null) // 'edit' | 'assign' | 'maintenance'

  const { truck, drivers, route } = data
  const driver = drivers.find((d) => d.id === truck.driverId)
  const status = truckStatusMeta[truck.status]
  const lastService = truck.maintenance[0]
  const close = () => setModal(null)

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow={<>Fleet Operations / <b>Truck Management</b></>}
        title="Truck Management"
        subtitle="The barangay's registered garbage collection truck"
        actions={
          <button type="button" className="ct-btn ct-btn--primary" onClick={() => setModal('maintenance')}>
            <Wrench size={16} /> Log Maintenance
          </button>
        }
      />

      <section className="ct-stats" aria-label="Truck summary">
        <StatCard label="Registered Truck" icon={Truck} value="1" unit="truck">
          <span>
            <b>{truck.id}</b> · {truck.plateNumber}
          </span>
        </StatCard>
        <StatCard label="Vehicle Status" icon={CircleCheck} value={status.label} highlight tone={truck.status === 'active' ? 'green' : 'amber'}>
          <span>Set by the barangay office</span>
        </StatCard>
        <StatCard label="Odometer" icon={Gauge} value={truck.odometerKm.toLocaleString()} unit="km">
          <span>Updated when maintenance is logged</span>
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
                    <th>Status</th>
                    <th className="is-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="is-selected">
                    <td>
                      <div className="ct-person">
                        <Truck size={18} color="var(--ct-green-900)" />
                        <span>
                          <strong>{truck.id}</strong>
                          <small className="ct-mono">{truck.plateNumber}</small>
                        </span>
                      </div>
                    </td>
                    <td>{truck.type}</td>
                    <td>
                      {driver ? (
                        <div className="ct-person">
                          <span className="ct-avatar">{driver.initials}</span>
                          {driver.name}
                        </div>
                      ) : (
                        <em className="truck-muted">Unassigned</em>
                      )}
                    </td>
                    <td>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </td>
                    <td>
                      <div className="ct-table__actions">
                        <button type="button" className="ct-icon-btn" aria-label="Edit vehicle" onClick={() => setModal('edit')}>
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="ct-table__foot">
              <span>
                Showing <strong>1</strong> registered barangay truck
              </span>
              <span>
                <Info size={12} /> CleanTrack is set up for one truck
              </span>
            </div>
          </article>

          <article className="ct-card">
            <div className="ct-card__header">
              <div>
                <h2>Maintenance History</h2>
                <p>{truck.maintenance.length} record(s)</p>
              </div>
            </div>
            <div className="ct-card__body">
              {truck.maintenance.length === 0 ? (
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
                      {truck.maintenance.map((m, i) => (
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
            subtitle={truck.type}
            badge={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
            footer={
              <>
                <button type="button" className="ct-btn ct-btn--secondary" onClick={() => setModal('edit')}>
                  <Pencil size={15} /> Edit Vehicle
                </button>
                <button type="button" className="ct-btn ct-btn--secondary" onClick={() => setModal('assign')}>
                  <UserPlus size={15} /> Assign Driver
                </button>
                <button type="button" className="ct-btn ct-btn--primary is-wide" onClick={() => setModal('maintenance')}>
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
                <dd>{truck.odometerKm.toLocaleString()} km</dd>
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
                    <em>Unassigned</em>
                  </p>
                )}
              </div>
              <div>
                <small>Assigned Route</small>
                <p>
                  <strong>{route.name}</strong>
                </p>
              </div>
              <div>
                <small>Current Location (simulated)</small>
                <p>
                  <MapPin size={13} /> {STATUS_LABELS[sim.status]} ·{' '}
                  <Link to="/admin/live-tracking">Open Live Tracking</Link>
                </p>
              </div>
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

      {modal === 'edit' && (
        <EditTruckModal
          truck={truck}
          onClose={close}
          onSave={(patch) => {
            dispatch({ type: 'truck/update', payload: patch }).then((res) => {
              if (!res.ok) return
              toast(`${truck.id} updated`)
              close()
            })
          }}
        />
      )}
      {modal === 'assign' && (
        <AssignDriverModal
          truck={truck}
          drivers={drivers}
          onClose={close}
          onSave={(driverId) => {
            dispatch({ type: 'truck/assignDriver', payload: { driverId } }).then((res) => {
              if (!res.ok) return
              const name = drivers.find((d) => d.id === driverId)?.name
              toast(name ? `${name} assigned to ${truck.id}` : `${truck.id} has no driver now`)
              close()
            })
          }}
        />
      )}
      {modal === 'maintenance' && (
        <LogMaintenanceModal
          truck={truck}
          onClose={close}
          onSave={(record) => {
            dispatch({ type: 'truck/logMaintenance', payload: record }).then((res) => {
              if (!res.ok) return
              toast('Maintenance logged')
              close()
            })
          }}
        />
      )}
    </div>
  )
}
