import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Contact, HardHat, IdCard, Pencil, Phone, Plus, RefreshCw, Route as RouteIcon, Trash2, Truck, UserCheck, UserX, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { DetailSection } from '../components/DetailPanel.jsx'
import DriverFormModal from '../components/driver/DriverFormModal.jsx'
import ChangeStatusModal from '../components/driver/ChangeStatusModal.jsx'
import CrewFormModal from '../components/crew/CrewFormModal.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import Modal from '../../components/Modal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Avatar from '../../components/Avatar.jsx'
import { useData } from '../../store/dataContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { driverStatusMeta, truckStatusMeta } from '../../store/selectors.js'
import { initials } from '../../store/dataReducer.js'
import { crewStatusMeta } from '../../data/crew.js'
import '../components/AdminPage.css'
import './CollectorsPage.css'

const accountLabel = { active: 'Active', disabled: 'Disabled', none: 'No account' }
const UNASSIGNED = 'unassigned'

// Collector's Management: one tab per truck (from the database) with its
// driver and crew as picture cards, plus an "Unassigned" tab. Details and
// management actions open from each card.
export default function CollectorsPage() {
  const { data, dispatch } = useData()
  const toast = useToast()
  const [params] = useSearchParams()
  const { drivers, truck, route } = data
  const crew = data.crew ?? []
  const trucks = [truck] // the system stores one truck; tabs follow the saved trucks
  const truckDriver = drivers.find((d) => d.id === truck.driverId)

  const collectors = [
    ...drivers.map((d) => ({ key: `driver:${d.id}`, type: 'driver', id: d.id, name: d.name, role: 'Driver', photo: d.photo, rec: d })),
    ...crew.map((c) => ({ key: `crew:${c.id}`, type: 'crew', id: c.id, name: c.name, role: c.role, photo: c.photo, rec: c })),
  ]
  const isOnTruck = (c, t = truck) => (c.type === 'driver' ? t.driverId === c.id : c.rec.truckId === t.id)
  const onTruck = (t) => collectors.filter((c) => isOnTruck(c, t)).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'driver' ? -1 : 1))
  const unassigned = collectors.filter((c) => !trucks.some((t) => isOnTruck(c, t)))
  const truckCrew = crew.filter((c) => c.truckId === truck.id && c.status === 'active')

  const [tab, setTab] = useState(params.get('tab') === UNASSIGNED ? UNASSIGNED : trucks[0]?.id ?? UNASSIGNED)
  const [selectedKey, setSelectedKey] = useState(null) // whose details are open
  const [modal, setModal] = useState(null) // 'addDriver' | 'addCrew' | 'edit' | 'status' | 'delete'
  const [saving, setSaving] = useState(false)
  const selected = collectors.find((c) => c.key === selectedKey) ?? null
  const shown = tab === UNASSIGNED ? unassigned : onTruck(trucks.find((t) => t.id === tab) ?? truck)
  const [fromCard, setFromCard] = useState(false) // Edit opened straight from a card
  const close = () => {
    setModal(null)
    // Back to the list (not to the details) when Edit was opened from a card.
    if (fromCard) {
      setSelectedKey(null)
      setFromCard(false)
    }
  }

  function save(action, message, after) {
    if (saving) return
    setSaving(true)
    dispatch(action).then((res) => {
      setSaving(false)
      if (!res.ok) return
      toast(message)
      after?.(res)
      close()
    })
  }

  // After adding someone, show the tab they belong to.
  const showTabOf = (truckId) => setTab(truckId && trucks.some((t) => t.id === truckId) ? truckId : UNASSIGNED)

  const statusBadge = (c) =>
    c.type === 'driver' ? (
      <StatusBadge tone={driverStatusMeta[c.rec.status].tone}>{driverStatusMeta[c.rec.status].label}</StatusBadge>
    ) : (
      <StatusBadge tone={crewStatusMeta[c.rec.status].tone}>{crewStatusMeta[c.rec.status].label}</StatusBadge>
    )

  return (
    <div className="admin-page">
      <PageHeader
        title="Collector's Management"
        badge="Drivers & Crew"
        subtitle="Who works on each garbage truck"
        actions={
          <>
            <button type="button" className="ct-btn ct-btn--secondary" onClick={() => setModal('addCrew')}>
              <Plus size={16} /> Add Crew Member
            </button>
            <button type="button" className="ct-btn ct-btn--primary" onClick={() => setModal('addDriver')}>
              <Plus size={16} /> Add Driver
            </button>
          </>
        }
      />

      <div className="col-tabs" role="tablist" aria-label="Trucks">
        {trucks.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="col-panel" className="col-tab" onClick={() => setTab(t.id)}>
            <Truck size={16} />
            <span>
              <strong>{t.id}</strong>
              <small>{t.plateNumber}</small>
            </span>
            <span className="col-tab__count">{onTruck(t).length}</span>
          </button>
        ))}
        <button type="button" role="tab" id={`tab-${UNASSIGNED}`} aria-selected={tab === UNASSIGNED} aria-controls="col-panel" className="col-tab" onClick={() => setTab(UNASSIGNED)}>
          <Users size={16} />
          <span>
            <strong>Unassigned</strong>
            <small>No truck</small>
          </span>
          <span className="col-tab__count">{unassigned.length}</span>
        </button>
      </div>

      <section id="col-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="ct-card col-panel">
        <header className="col-panel__head">
          {tab === UNASSIGNED ? (
            <div>
              <h2>Unassigned Collectors</h2>
              <p>Not on any truck yet. Open a person to assign them.</p>
            </div>
          ) : (
            <>
              <div>
                <h2>
                  {truck.id} · {truck.type}
                </h2>
                <p>
                  <RouteIcon size={12} /> {route.name} · plate {truck.plateNumber}
                </p>
              </div>
              <StatusBadge tone={truckStatusMeta[truck.status].tone}>{truckStatusMeta[truck.status].label}</StatusBadge>
            </>
          )}
        </header>

        {shown.length === 0 ? (
          <p className="ct-empty">{tab === UNASSIGNED ? 'Everyone is assigned to a truck.' : 'No driver or crew assigned to this truck yet.'}</p>
        ) : (
          <ul className="col-grid">
            {shown.map((c) => (
              <li key={c.key} className={`col-card ${c.type === 'crew' && c.rec.status === 'inactive' ? 'is-inactive' : ''}`}>
                <button type="button" className="col-card__open" onClick={() => setSelectedKey(c.key)} aria-label={`${c.name}, ${c.role}: open details`}>
                  <Avatar photo={c.photo} initials={c.rec.initials || initials(c.name)} name={c.name} className="ct-avatar col-card__avatar" />
                  <strong className="col-card__name">{c.name}</strong>
                  <span className="col-card__role">
                    {c.type === 'driver' ? <Contact size={13} /> : <HardHat size={13} />} {c.role}
                  </span>
                  {(c.type === 'driver' ? c.rec.status !== 'on-shift' : c.rec.status === 'inactive') && <span className="col-card__status">{statusBadge(c)}</span>}
                </button>
                <button
                  type="button"
                  className="ct-icon-btn col-card__edit"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => {
                    setSelectedKey(c.key)
                    setFromCard(true)
                    setModal('edit')
                  }}
                >
                  <Pencil size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && !modal && (
        <Modal
          title={selected.name}
          subtitle={`${selected.role} · ${selected.id}`}
          icon={selected.type === 'driver' ? Contact : HardHat}
          size="lg"
          onClose={() => setSelectedKey(null)}
          footer={
            <div className="col-details__actions">
              {selected.type === 'driver' ? driverActions() : crewActions()}
              <button type="button" className="ct-btn ct-btn--danger" onClick={() => setModal('delete')}>
                <Trash2 size={15} /> Remove
              </button>
            </div>
          }
        >
          <div className="col-details">
            <div className="col-details__who">
              <Avatar photo={selected.photo} initials={selected.rec.initials || initials(selected.name)} name={selected.name} className="ct-avatar col-details__avatar" />
              <div>
                <strong>{selected.name}</strong>
                <span>{selected.role}</span>
                {statusBadge(selected)}
              </div>
            </div>
            {selected.type === 'driver' ? driverDetails() : crewDetails()}
          </div>
        </Modal>
      )}

      {modal === 'addDriver' && (
        <DriverFormModal
          driver={null}
          saving={saving}
          onClose={close}
          onSave={(form) =>
            save({ type: 'driver/add', payload: form }, `${form.name} added`, () => {
              setSelectedKey(null)
              showTabOf(null)
            })
          }
        />
      )}
      {modal === 'addCrew' && (
        <CrewFormModal
          member={null}
          truck={truck}
          saving={saving}
          onClose={close}
          onSave={(form) =>
            save({ type: 'crew/add', payload: form }, `${form.name} added`, (res) => {
              setSelectedKey(null)
              showTabOf((res.data.crew ?? []).at(-1)?.truckId)
            })
          }
        />
      )}
      {modal === 'edit' && selected?.type === 'driver' && (
        <DriverFormModal
          driver={selected.rec}
          saving={saving}
          onClose={close}
          onSave={(form) => save({ type: 'driver/update', payload: { id: selected.id, patch: form } }, `${form.name} updated`)}
        />
      )}
      {modal === 'edit' && selected?.type === 'crew' && (
        <CrewFormModal
          member={selected.rec}
          truck={truck}
          saving={saving}
          onClose={close}
          onSave={(form) => save({ type: 'crew/update', payload: { id: selected.id, patch: form } }, `${form.name} updated`)}
        />
      )}
      {modal === 'status' && selected?.type === 'driver' && (
        <ChangeStatusModal
          driver={selected.rec}
          onClose={close}
          onSave={(status) => save({ type: 'driver/update', payload: { id: selected.id, patch: { status } } }, `${selected.name}: ${driverStatusMeta[status].label}`)}
        />
      )}
      {modal === 'delete' && selected && (
        <ConfirmModal
          title={selected.type === 'driver' ? 'Delete Driver' : 'Remove Crew Member'}
          confirmLabel={selected.type === 'driver' ? 'Delete Driver' : 'Remove'}
          onClose={close}
          onConfirm={() => {
            dispatch({ type: selected.type === 'driver' ? 'driver/delete' : 'crew/delete', payload: { id: selected.id } }).then((res) => {
              if (!res.ok) return
              toast(`${selected.name} removed`)
              setSelectedKey(null)
            })
          }}
        >
          <p>
            Remove <strong>{selected.name}</strong> ({selected.id}) from the collectors list?
            {selected.type === 'crew' && ' To keep the record, mark them Inactive instead.'}
          </p>
          {selected.type === 'driver' && isOnTruck(selected) && (
            <div className="ct-alert ct-alert--warning">
              {selected.name} is assigned to {truck.id}. The truck will have no driver until you assign another.
            </div>
          )}
        </ConfirmModal>
      )}
    </div>
  )

  // ---------- Detail panel parts (use `selected` from above) ----------
  function driverDetails() {
    const d = selected.rec
    const assigned = isOnTruck(selected)
    return (
      <>
        <DetailSection icon={Truck} title="Assignment">
          <div>
            <small>Assigned Truck</small>
            <p>
              <strong>{assigned ? `${truck.id} · ${truck.type} (${truck.plateNumber})` : 'Not assigned'}</strong>
            </p>
          </div>
          <div>
            <small>
              <RouteIcon size={11} /> Assigned Route
            </small>
            <p>
              <strong>{assigned ? route.name : '—'}</strong>
            </p>
          </div>
          <div>
            <small>Shift Hours</small>
            <p>
              <strong>{d.shift}</strong>
            </p>
          </div>
          {assigned && (
            <div>
              <small>Crew on this truck</small>
              <p>
                <strong>{truckCrew.length ? truckCrew.map((c) => `${c.name} (${c.role})`).join(', ') : 'No crew assigned yet'}</strong>
              </p>
            </div>
          )}
        </DetailSection>
        <DetailSection icon={IdCard} title="Credentials & Contact">
          <div>
            <small>Professional License</small>
            <p>
              <strong>{d.license}</strong>
            </p>
          </div>
          <div>
            <small>Work Contact</small>
            <p>
              <Phone size={13} /> <strong>{d.phone}</strong>
            </p>
          </div>
          <div>
            <small>Driver App Sign-in</small>
            <p>
              <strong>{accountLabel[d.account ?? 'none']}</strong>
            </p>
          </div>
        </DetailSection>
      </>
    )
  }

  function driverActions() {
    const assigned = isOnTruck(selected)
    return (
      <>
        <button type="button" className="ct-btn ct-btn--primary is-wide" onClick={() => setModal('status')}>
          <RefreshCw size={15} /> Change Availability
        </button>
        <button type="button" className="ct-btn ct-btn--secondary" onClick={() => setModal('edit')}>
          <Pencil size={15} /> Edit Driver
        </button>
        <button
          type="button"
          className="ct-btn ct-btn--secondary"
          disabled={saving}
          onClick={() =>
            save(
              { type: 'truck/assignDriver', payload: { driverId: assigned ? null : selected.id } },
              assigned ? `${selected.name} removed from ${truck.id}` : `${selected.name} assigned to ${truck.id}`,
            )
          }
        >
          <Truck size={15} /> {assigned ? 'Unassign Truck' : `Assign to ${truck.id}`}
        </button>
      </>
    )
  }

  function crewDetails() {
    const c = selected.rec
    return (
      <>
        <DetailSection icon={Truck} title="Assignment">
          <div>
            <small>Assigned Truck</small>
            <p>
              <strong>{c.truckId ? `${truck.id} · ${truck.type} (${truck.plateNumber})` : 'Not assigned'}</strong>
            </p>
          </div>
          <div>
            <small>Works With (Driver)</small>
            <p>
              <strong>{c.truckId ? (truckDriver?.name ?? 'No driver assigned') : '—'}</strong>
            </p>
          </div>
          <div>
            <small>
              <RouteIcon size={11} /> Route
            </small>
            <p>
              <strong>{c.truckId ? route.name : '—'}</strong>
            </p>
          </div>
        </DetailSection>
        <DetailSection icon={HardHat} title="Role & Contact">
          <div>
            <small>Role / Position</small>
            <p>
              <strong>{c.role}</strong>
            </p>
          </div>
          <div>
            <small>Work Contact</small>
            <p>
              {c.phone ? (
                <>
                  <Phone size={13} /> <strong>{c.phone}</strong>
                </>
              ) : (
                <strong>Not given</strong>
              )}
            </p>
          </div>
        </DetailSection>
      </>
    )
  }

  function crewActions() {
    const c = selected.rec
    return (
      <>
        <button type="button" className="ct-btn ct-btn--primary is-wide" onClick={() => setModal('edit')}>
          <Pencil size={15} /> Edit Crew Member
        </button>
        <button
          type="button"
          className="ct-btn ct-btn--secondary"
          disabled={saving}
          onClick={() =>
            save(
              { type: 'crew/update', payload: { id: c.id, patch: { ...c, truckId: c.truckId ? null : truck.id } } },
              c.truckId ? `${c.name} removed from ${truck.id}` : `${c.name} assigned to ${truck.id}`,
            )
          }
        >
          <Truck size={15} /> {c.truckId ? 'Unassign Truck' : `Assign to ${truck.id}`}
        </button>
        <button
          type="button"
          className="ct-btn ct-btn--secondary"
          disabled={saving}
          onClick={() =>
            save(
              { type: 'crew/update', payload: { id: c.id, patch: { ...c, status: c.status === 'active' ? 'inactive' : 'active' } } },
              `${c.name} is now ${c.status === 'active' ? 'inactive' : 'active'}`,
            )
          }
        >
          {c.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />} Mark {c.status === 'active' ? 'Inactive' : 'Active'}
        </button>
      </>
    )
  }
}
