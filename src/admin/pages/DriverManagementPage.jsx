import { useState } from 'react'
import {
  CalendarOff,
  Clock,
  Contact,
  Eye,
  IdCard,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  UserCheck,
} from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import DetailPanel, { DetailSection } from '../components/DetailPanel.jsx'
import DriverFormModal from '../components/driver/DriverFormModal.jsx'
import ChangeStatusModal from '../components/driver/ChangeStatusModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { driverStatusMeta } from '../../store/selectors.js'
import '../components/AdminPage.css'

// PDF pages 18-20
export default function DriverManagementPage() {
  const { data, dispatch } = useData()
  const toast = useToast()
  const { drivers, truck, route } = data

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(drivers[0]?.id ?? null)
  const [modal, setModal] = useState(null) // 'add' | 'edit' | 'status' | 'delete'

  const q = query.trim().toLowerCase()
  const visible = drivers.filter(
    (d) =>
      (statusFilter === 'all' || d.status === statusFilter) &&
      (!q || [d.name, d.id, d.phone].some((v) => v.toLowerCase().includes(q))),
  )
  const selected = drivers.find((d) => d.id === selectedId) ?? null
  const count = (s) => drivers.filter((d) => d.status === s).length
  const isAssigned = (d) => truck.driverId === d.id
  const close = () => setModal(null)

  return (
    <div className="admin-page">
      <PageHeader
        title="Driver Management"
        badge="Barangay Drivers"
        subtitle="Registered garbage collection drivers and their availability"
        actions={
          <button type="button" className="ct-btn ct-btn--primary" onClick={() => setModal('add')}>
            <Plus size={16} /> Add Driver
          </button>
        }
      />

      <section className="ct-stats" aria-label="Driver summary">
        <StatCard label="Total Registered Drivers" icon={Contact} value={drivers.length} unit="drivers">
          <span>Barangay San Antonio</span>
        </StatCard>
        <StatCard label="On Active Shift" icon={UserCheck} value={count('on-shift')} unit="drivers" highlight>
          <span>Currently operating</span>
        </StatCard>
        <StatCard label="On Standby" icon={Clock} value={count('standby')} unit="drivers">
          <span>Available for relief</span>
        </StatCard>
        <StatCard label="On Leave / Off-Duty" icon={CalendarOff} value={count('off-duty')} unit="drivers">
          <span>Off shift today</span>
        </StatCard>
      </section>

      <div className="ct-split">
        <article className="ct-card">
          <div className="ct-card__header">
            <div>
              <h2>Registered Driver Roster</h2>
              <p>{drivers.length} driver(s) assigned to barangay waste operations</p>
            </div>
          </div>
          <div className="ct-toolbar">
            <div className="ct-input-group">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search name, ID, or phone…"
                aria-label="Search drivers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select className="ct-input" aria-label="Filter by availability" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All availability</option>
              {Object.entries(driverStatusMeta).map(([v, m]) => (
                <option key={v} value={v}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="ct-empty">{drivers.length === 0 ? 'No drivers yet. Click “Add Driver”.' : 'No drivers match your search.'}</p>
          ) : (
            <div className="ct-table-wrap">
              <table className="ct-table">
                <thead>
                  <tr>
                    <th>Driver Name</th>
                    <th>Assigned Truck</th>
                    <th>Shift</th>
                    <th>Availability</th>
                    <th className="is-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const meta = driverStatusMeta[d.status]
                    return (
                      <tr
                        key={d.id}
                        className={`is-clickable ${d.id === selectedId ? 'is-selected' : ''}`}
                        onClick={() => setSelectedId(d.id)}
                      >
                        <td>
                          <div className="ct-person">
                            <span className="ct-avatar">{d.initials}</span>
                            <span>
                              <strong>{d.name}</strong>
                              <small className="ct-mono">{d.id}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          {isAssigned(d) ? (
                            <>
                              <Truck size={14} /> {truck.id} ({truck.type})
                            </>
                          ) : (
                            <span className="ct-tag">Unassigned</span>
                          )}
                        </td>
                        <td>{d.shift}</td>
                        <td>
                          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                        </td>
                        <td>
                          <div className="ct-table__actions" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="ct-icon-btn" aria-label={`View ${d.name}`} onClick={() => setSelectedId(d.id)}>
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              className="ct-icon-btn"
                              aria-label={`Edit ${d.name}`}
                              onClick={() => {
                                setSelectedId(d.id)
                                setModal('edit')
                              }}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="ct-icon-btn"
                              aria-label={`Delete ${d.name}`}
                              onClick={() => {
                                setSelectedId(d.id)
                                setModal('delete')
                              }}
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
          )}
          <div className="ct-table__foot">
            <span>
              Showing {visible.length} of {drivers.length} registered drivers
            </span>
          </div>
        </article>

        {selected ? (
          <DetailPanel
            title={selected.name}
            subtitle={<span className="ct-mono">{selected.id}</span>}
            badge={<StatusBadge tone={driverStatusMeta[selected.status].tone}>{driverStatusMeta[selected.status].label}</StatusBadge>}
            onClose={() => setSelectedId(null)}
            footer={
              <>
                <button type="button" className="ct-btn ct-btn--primary is-wide" onClick={() => setModal('status')}>
                  <RefreshCw size={15} /> Change Availability
                </button>
                <button type="button" className="ct-btn ct-btn--secondary" onClick={() => setModal('edit')}>
                  <Pencil size={15} /> Edit Driver
                </button>
                {isAssigned(selected) ? (
                  <button
                    type="button"
                    className="ct-btn ct-btn--secondary"
                    onClick={() => {
                      dispatch({ type: 'truck/assignDriver', payload: { driverId: null } })
                      toast(`${selected.name} removed from ${truck.id}`)
                    }}
                  >
                    <Truck size={15} /> Unassign Truck
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ct-btn ct-btn--secondary"
                    onClick={() => {
                      dispatch({ type: 'truck/assignDriver', payload: { driverId: selected.id } })
                      toast(`${selected.name} assigned to ${truck.id}`)
                    }}
                  >
                    <Truck size={15} /> Assign to {truck.id}
                  </button>
                )}
              </>
            }
          >
            <DetailSection icon={Truck} title="Assignment Information">
              <div>
                <small>Assigned Truck</small>
                <p>
                  <strong>{isAssigned(selected) ? `${truck.id} · ${truck.type} (${truck.plateNumber})` : 'Not assigned'}</strong>
                </p>
              </div>
              <div>
                <small>Assigned Route</small>
                <p>
                  <strong>{isAssigned(selected) ? route.name : '—'}</strong>
                </p>
              </div>
              <div>
                <small>Shift Hours</small>
                <p>
                  <strong>{selected.shift}</strong>
                </p>
              </div>
            </DetailSection>
            <DetailSection icon={IdCard} title="Credentials & Contact">
              <div>
                <small>Professional License</small>
                <p>
                  <strong>{selected.license}</strong>
                </p>
              </div>
              <div>
                <small>Work Contact</small>
                <p>
                  <Phone size={13} /> <strong>{selected.phone}</strong>
                </p>
              </div>
            </DetailSection>
          </DetailPanel>
        ) : (
          <div className="ct-card ct-empty">Select a driver to see details.</div>
        )}
      </div>

      {modal === 'add' && (
        <DriverFormModal
          driver={null}
          onClose={close}
          onSave={(form) => {
            dispatch({ type: 'driver/add', payload: form })
            toast(`${form.name} added`)
            close()
          }}
        />
      )}
      {modal === 'edit' && selected && (
        <DriverFormModal
          driver={selected}
          onClose={close}
          onSave={(form) => {
            dispatch({ type: 'driver/update', payload: { id: selected.id, patch: form } })
            toast(`${form.name} updated`)
            close()
          }}
        />
      )}
      {modal === 'status' && selected && (
        <ChangeStatusModal
          driver={selected}
          onClose={close}
          onSave={(status) => {
            dispatch({ type: 'driver/update', payload: { id: selected.id, patch: { status } } })
            toast(`${selected.name}: ${driverStatusMeta[status].label}`)
            close()
          }}
        />
      )}
      {modal === 'delete' && selected && (
        <ConfirmModal
          title="Delete Driver"
          confirmLabel="Delete Driver"
          onClose={close}
          onConfirm={() => {
            dispatch({ type: 'driver/delete', payload: { id: selected.id } })
            toast(`${selected.name} deleted`)
            setSelectedId(drivers.find((d) => d.id !== selected.id)?.id ?? null)
          }}
        >
          <p>
            Remove <strong>{selected.name}</strong> ({selected.id}) from the driver roster?
          </p>
          {isAssigned(selected) && (
            <div className="ct-alert ct-alert--warning">
              {selected.name} is assigned to {truck.id}. The truck will have no driver until you assign another.
            </div>
          )}
        </ConfirmModal>
      )}
    </div>
  )
}
