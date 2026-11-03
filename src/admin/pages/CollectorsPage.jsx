import { useState } from 'react'
import { Clock, Contact, HardHat, IdCard, Pencil, Phone, Plus, RefreshCw, Route as RouteIcon, Star, Trash2, Truck, UserCheck, UserX } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { DetailSection } from '../components/DetailPanel.jsx'
import ChangeStatusModal from '../components/driver/ChangeStatusModal.jsx'
import CollectorFormModal from '../components/collectors/CollectorFormModal.jsx'
import RoleBadge from '../components/collectors/RoleBadge.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import Modal from '../../components/Modal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Avatar from '../../components/Avatar.jsx'
import { useData } from '../../store/dataContext.js'
import { useToast } from '../../components/toast/toastContext.js'
import { driverStatusMeta, truckStatusMeta } from '../../store/selectors.js'
import { initials } from '../../store/dataReducer.js'
import { LIMITS, ROLES, SHIFTS, SHIFT_KEYS, SHIFT_LIMIT, TOTAL_LIMIT, TOTAL_LIMITS, capacityOf, collectorsOf, fullMessage, hasRoom, holdsSlot, shiftLabel, shiftWithHours } from '../../data/personnel.js'
import '../components/AdminPage.css'
import './CollectorsPage.css'

const accountLabel = { active: 'Active', disabled: 'Disabled', none: 'No account' }
const byName = (a, b) => a.name.localeCompare(b.name)

// Collector's Management for the barangay's one truck: capacity summary, then
// the Morning and Afternoon shift rosters (1 Driver + 3 Crew Members each).
// All counts come from the saved records (src/data/personnel.js).
export default function CollectorsPage() {
  const { data, dispatch } = useData()
  const toast = useToast()
  const { drivers, truck, route } = data
  const collectors = collectorsOf(data)
  const cap = capacityOf(data)
  const onDuty = drivers.find((d) => d.id === truck.driverId)

  const [selectedKey, setSelectedKey] = useState(null) // whose details are open
  const [modal, setModal] = useState(null) // 'add' | 'edit' | 'status' | 'delete'
  const [preset, setPreset] = useState(null) // Add form opened from an open slot
  const [fromCard, setFromCard] = useState(false) // Edit opened straight from a card
  const [saving, setSaving] = useState(false)
  const selected = collectors.find((c) => c.key === selectedKey) ?? null

  const close = () => {
    setModal(null)
    setPreset(null)
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

  const inShift = (s) => collectors.filter((c) => c.truckId === truck.id && c.shift === s)
  const offRoster = collectors.filter((c) => !(c.truckId === truck.id && SHIFTS[c.shift])).sort(byName)

  const openAdd = (p = null) => {
    setPreset(p)
    setModal('add')
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Collector's Management"
        badge="Drivers & Crew"
        subtitle={`Who works on ${truck.id}, by shift`}
        actions={
          <button type="button" className="ct-btn ct-btn--primary" onClick={() => openAdd()}>
            <Plus size={16} /> Add Collector
          </button>
        }
      />

      <section className="ct-card col-truck" aria-labelledby="col-truck-title">
        <header className="col-truck__head">
          <span className="col-truck__icon" aria-hidden="true">
            <Truck size={22} />
          </span>
          <div className="col-truck__title">
            <h2 id="col-truck-title">
              {truck.id} · {truck.type}
            </h2>
            <p>
              <RouteIcon size={12} /> {route.name} · plate {truck.plateNumber}
            </p>
          </div>
          <div className="col-truck__duty">
            <small>Driver on duty</small>
            <strong>{onDuty ? `${onDuty.name} (${shiftLabel(onDuty.shift)})` : 'No driver on duty'}</strong>
          </div>
          <StatusBadge tone={truckStatusMeta[truck.status].tone}>{truckStatusMeta[truck.status].label}</StatusBadge>
        </header>

        <ul className="col-summary" aria-label="Personnel capacity">
          <SummaryTile label="Total Drivers" used={cap.drivers} max={TOTAL_LIMITS.driver} pips={Array(TOTAL_LIMITS.driver).fill('driver')} />
          <SummaryTile label="Total Crew Members" used={cap.crew} max={TOTAL_LIMITS.crew} pips={Array(TOTAL_LIMITS.crew).fill('crew')} />
          {SHIFT_KEYS.map((s) => (
            <SummaryTile key={s} label={SHIFTS[s].label} used={cap.shiftTotal(s)} max={SHIFT_LIMIT} pips={shiftPips(cap.shifts[s])} />
          ))}
          <SummaryTile label="Overall Personnel" used={cap.overall} max={TOTAL_LIMIT} pips={SHIFT_KEYS.flatMap((s) => shiftPips(cap.shifts[s]))} wide />
        </ul>
        <p className="col-summary__note">
          Each shift: {LIMITS.driver} Driver + {LIMITS.crew} Crew Members. Only <strong>active</strong> people take a place; inactive people keep their record and free their place.
        </p>
      </section>

      {SHIFT_KEYS.map((s) => shiftSection(s, inShift(s)))}

      {offRoster.length > 0 && (
        <section className="ct-card col-shift" aria-labelledby="col-off-title">
          <header className="col-shift__head">
            <div>
              <h2 id="col-off-title">Not on a shift</h2>
              <p>Saved collectors who are not on the {truck.id} roster. Edit a person to give them a shift.</p>
            </div>
          </header>
          <ul className="col-grid">{offRoster.map(personCard)}</ul>
        </section>
      )}

      {selected && !modal && (
        <Modal
          title={selected.name}
          subtitle={`${ROLES[selected.type].label} · ${selected.id}`}
          icon={selected.type === 'driver' ? Contact : HardHat}
          size="lg"
          onClose={() => setSelectedKey(null)}
          footer={
            <div className="col-details__actions">
              {detailActions()}
              <button type="button" className="ct-btn ct-btn--danger" onClick={() => setModal('delete')}>
                <Trash2 size={15} /> Remove
              </button>
            </div>
          }
        >
          <div className="col-details">
            <div className="col-details__who">
              <Avatar photo={selected.rec.photo} initials={selected.rec.initials || initials(selected.name)} name={selected.name} className="ct-avatar col-details__avatar" />
              <div>
                <strong>{selected.name}</strong>
                <span className="col-details__badges">
                  <RoleBadge type={selected.type} />
                  <ActiveBadge active={selected.active} />
                </span>
                <span>{shiftWithHours(selected.shift)}</span>
              </div>
            </div>
            {details()}
          </div>
        </Modal>
      )}

      {modal === 'add' && (
        <CollectorFormModal
          key={`${preset?.type}-${preset?.shift}`}
          record={null}
          preset={preset}
          data={data}
          saving={saving}
          onClose={close}
          onSave={(type, form) => save({ type: type === 'driver' ? 'driver/add' : 'crew/add', payload: form }, `${form.name} added as ${ROLES[type].label}`, () => setSelectedKey(null))}
        />
      )}
      {modal === 'edit' && selected && (
        <CollectorFormModal
          record={selected}
          data={data}
          saving={saving}
          onClose={close}
          onSave={(type, form) => save({ type: type === 'driver' ? 'driver/update' : 'crew/update', payload: { id: selected.id, patch: form } }, `${form.name} updated`)}
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
          title={`Remove ${ROLES[selected.type].label}`}
          confirmLabel="Remove"
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
            Remove <strong>{selected.name}</strong> ({selected.id}) from the collectors list? To keep the record, mark them Inactive instead.
          </p>
          {selected.type === 'driver' && truck.driverId === selected.id && (
            <div className="ct-alert ct-alert--warning">
              {selected.name} is the driver on duty for {truck.id}. The truck will have no driver on duty until you choose another.
            </div>
          )}
        </ConfirmModal>
      )}
    </div>
  )

  // ---------- Page parts ----------
  function shiftSection(shift, people) {
    const activeOf = (type) => people.filter((p) => p.type === type && p.active).sort(byName)
    const activeDrivers = activeOf('driver')
    const activeCrew = activeOf('crew')
    const inactive = people.filter((p) => !p.active).sort((a, b) => (a.type === b.type ? byName(a, b) : a.type === 'driver' ? -1 : 1))
    const openDrivers = Math.max(0, LIMITS.driver - activeDrivers.length)
    const openCrew = Math.max(0, LIMITS.crew - activeCrew.length)
    const id = `col-${shift}-title`
    return (
      <section key={shift} className={`ct-card col-shift col-shift--${shift}`} aria-labelledby={id}>
        <header className="col-shift__head">
          <div>
            <h2 id={id}>
              <Clock size={17} aria-hidden="true" /> {SHIFTS[shift].label}
            </h2>
            <p>{SHIFTS[shift].hours}</p>
          </div>
          <div className="col-shift__counts" aria-label={`${SHIFTS[shift].label} places`}>
            <span>
              {SHIFTS[shift].short} Drivers: <strong>{cap.shifts[shift].driver}/{LIMITS.driver}</strong>
            </span>
            <span>
              {SHIFTS[shift].short} Crew: <strong>{cap.shifts[shift].crew}/{LIMITS.crew}</strong>
            </span>
          </div>
        </header>
        <ul className="col-grid col-grid--slots">
          {activeDrivers.map(personCard)}
          {Array.from({ length: openDrivers }, (_, i) => openSlot('driver', shift, i))}
          {activeCrew.map(personCard)}
          {Array.from({ length: openCrew }, (_, i) => openSlot('crew', shift, i))}
        </ul>
        {inactive.length > 0 && (
          <>
            <h3 className="col-shift__sub">Inactive on this shift ({inactive.length}) · not using a place</h3>
            <ul className="col-grid">{inactive.map(personCard)}</ul>
          </>
        )}
      </section>
    )
  }

  function personCard(c) {
    const isOnDuty = c.type === 'driver' && truck.driverId === c.id
    return (
      <li key={c.key} className={`col-card col-card--${c.type} ${c.active ? '' : 'is-inactive'}`}>
        <button type="button" className="col-card__open" onClick={() => setSelectedKey(c.key)} aria-label={`${c.name}, ${ROLES[c.type].label}, ${shiftLabel(c.shift)}, ${c.active ? 'Active' : 'Inactive'}: open details`}>
          <Avatar photo={c.rec.photo} initials={c.rec.initials || initials(c.name)} name={c.name} className="ct-avatar col-card__avatar" />
          <strong className="col-card__name">{c.name}</strong>
          <RoleBadge type={c.type} />
          <span className="col-card__shift">{shiftLabel(c.shift)}</span>
          <span className="col-card__status">
            <ActiveBadge active={c.active} />
            {isOnDuty && (
              <span className="col-card__duty">
                <Star size={11} aria-hidden="true" /> On duty
              </span>
            )}
          </span>
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
    )
  }

  function openSlot(type, shift, i) {
    return (
      <li key={`open-${type}-${i}`} className={`col-slot col-slot--${type}`}>
        <button type="button" className="col-slot__btn" onClick={() => openAdd({ type, shift })} aria-label={`Open ${ROLES[type].label} place, ${SHIFTS[shift].label}: add a collector`}>
          <span className="col-slot__plus" aria-hidden="true">
            <Plus size={22} />
          </span>
          <strong>Open place</strong>
          <RoleBadge type={type} size="sm" />
          <small>Add {ROLES[type].label}</small>
        </button>
      </li>
    )
  }

  // ---------- Detail dialog parts (use `selected` from above) ----------
  function details() {
    const c = selected.rec
    const isDriver = selected.type === 'driver'
    const sameShiftCrew = collectors.filter((x) => x.type === 'crew' && x.active && holdsSlot(x, truck.id) && x.shift === selected.shift)
    const shiftDriver = collectors.find((x) => x.type === 'driver' && x.active && holdsSlot(x, truck.id) && x.shift === selected.shift)
    const onRoster = selected.truckId === truck.id && SHIFTS[selected.shift]
    return (
      <>
        <DetailSection icon={Truck} title="Shift Assignment">
          <div>
            <small>Truck</small>
            <p>
              <strong>{onRoster ? `${truck.id} · ${truck.type} (${truck.plateNumber})` : 'Not on the roster'}</strong>
            </p>
          </div>
          <div>
            <small>Shift</small>
            <p>
              <strong>{shiftWithHours(selected.shift)}</strong>
            </p>
          </div>
          <div>
            <small>Place on the shift</small>
            <p>
              <strong>{holdsSlot(selected, truck.id) ? 'Uses a place (active)' : selected.active ? 'No place (not on a shift)' : 'No place (inactive)'}</strong>
            </p>
          </div>
          {onRoster && (
            <div>
              <small>{isDriver ? 'Crew on this shift' : 'Driver on this shift'}</small>
              <p>
                <strong>
                  {isDriver
                    ? sameShiftCrew.length
                      ? sameShiftCrew.map((x) => x.name).join(', ')
                      : 'No crew yet'
                    : (shiftDriver?.name ?? 'No driver yet')}
                </strong>
              </p>
            </div>
          )}
        </DetailSection>
        <DetailSection icon={IdCard} title={isDriver ? 'Credentials & Contact' : 'Position & Contact'}>
          {isDriver ? (
            <>
              <div>
                <small>Professional License</small>
                <p>
                  <strong>{c.license}</strong>
                </p>
              </div>
              <div>
                <small>Availability today</small>
                <p>
                  <StatusBadge tone={driverStatusMeta[c.status].tone}>{driverStatusMeta[c.status].label}</StatusBadge>
                </p>
              </div>
              <div>
                <small>Driver App Sign-in</small>
                <p>
                  <strong>{accountLabel[c.account ?? 'none']}</strong>
                </p>
              </div>
            </>
          ) : (
            <div>
              <small>Position</small>
              <p>
                <strong>{c.role}</strong>
              </p>
            </div>
          )}
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

  function detailActions() {
    const c = selected.rec
    const isDriver = selected.type === 'driver'
    // Making someone Active needs a free place on their shift.
    const canActivate = !selected.shift || hasRoom(data, selected.type, selected.shift, { excludeKey: selected.key })
    const toggleActive = () =>
      save(
        isDriver
          ? { type: 'driver/update', payload: { id: c.id, patch: { active: !selected.active } } }
          : { type: 'crew/update', payload: { id: c.id, patch: { ...c, status: selected.active ? 'inactive' : 'active' } } },
        `${selected.name} is now ${selected.active ? 'inactive' : 'active'}`,
      )
    const canDrive = isDriver && holdsSlot(selected, truck.id) && truck.driverId !== c.id
    return (
      <>
        <button type="button" className="ct-btn ct-btn--primary is-wide" onClick={() => setModal('edit')}>
          <Pencil size={15} /> Edit {ROLES[selected.type].label}
        </button>
        {isDriver && (
          <button type="button" className="ct-btn ct-btn--secondary" onClick={() => setModal('status')}>
            <RefreshCw size={15} /> Change Availability
          </button>
        )}
        {canDrive && (
          <button type="button" className="ct-btn ct-btn--secondary" disabled={saving} onClick={() => save({ type: 'truck/assignDriver', payload: { driverId: c.id } }, `${selected.name} is now driving ${truck.id}`)}>
            <Star size={15} /> Make Driver on Duty
          </button>
        )}
        <button
          type="button"
          className="ct-btn ct-btn--secondary"
          disabled={saving || (!selected.active && !canActivate)}
          title={!selected.active && !canActivate ? fullMessage(selected.type, selected.shift) : undefined}
          onClick={toggleActive}
        >
          {selected.active ? <UserX size={15} /> : <UserCheck size={15} />} Mark {selected.active ? 'Inactive' : 'Active'}
        </button>
        {!selected.active && !canActivate && (
          <p className="col-details__blocked" role="status">
            {fullMessage(selected.type, selected.shift)}
          </p>
        )}
      </>
    )
  }
}

// Driver pip first, then crew pips (one per place on the shift).
function shiftPips(counts) {
  return [
    ...Array.from({ length: LIMITS.driver }, (_, i) => ({ type: 'driver', filled: i < counts.driver })),
    ...Array.from({ length: LIMITS.crew }, (_, i) => ({ type: 'crew', filled: i < counts.crew })),
  ]
}

function SummaryTile({ label, used, max, pips, wide = false }) {
  const open = max - used
  // pips: 'driver' | 'crew' strings (filled in order) or { type, filled }.
  const list = pips.map((p, i) => (typeof p === 'string' ? { type: p, filled: i < used } : p))
  return (
    <li className={`col-stat ${wide ? 'col-stat--wide' : ''} ${open === 0 ? 'is-full' : ''}`}>
      <span className="col-stat__label">{label}</span>
      <span className="col-stat__value">
        {used}
        <small>/{max}</small>
      </span>
      <span className="col-stat__pips" aria-hidden="true">
        {list.map((p, i) => (
          <span key={i} className={`col-pip col-pip--${p.type} ${p.filled ? 'is-filled' : ''}`} />
        ))}
      </span>
      <span className="col-stat__open">
        {used} occupied · {open === 0 ? <strong>Full</strong> : `${open} open`}
      </span>
    </li>
  )
}

function ActiveBadge({ active }) {
  return <StatusBadge tone={active ? 'green' : 'gray'}>{active ? 'Active' : 'Inactive'}</StatusBadge>
}
