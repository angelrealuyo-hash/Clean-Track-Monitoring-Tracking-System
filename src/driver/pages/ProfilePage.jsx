import { useState } from 'react'
import { Headset, IdCard, Phone, Play, Route as RouteIcon, Siren, Square, Truck, KeyRound } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import SignOutButton from '../../components/SignOutButton.jsx'
import ChangePasswordModal from '../../components/ChangePasswordModal.jsx'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { useRouteActions } from '../components/useRouteActions.js'
import { useToast } from '../../components/toast/toastContext.js'
import { driverStatusMeta, truckStatusMeta } from '../../store/selectors.js'
import { barangay } from '../../data/barangay.js'
import './DriverPages.css'

const tel = (n) => `tel:${n.replace(/[^\d+]/g, '')}`

// PDF page 49
export default function ProfilePage() {
  const [pwOpen, setPwOpen] = useState(false)
  const r = useDriverRoute()
  const toast = useToast()
  const { driver, truck, route, summary, assigned, dispatch } = r
  const status = driverStatusMeta[driver.status]
  const onShift = driver.status === 'on-shift'
  const { runActive, endRoute } = useRouteActions(r)

  function setShift(next) {
    dispatch({ type: 'driver/update', payload: { id: driver.id, patch: { status: next } } }).then((res) => {
      if (!res.ok) return
      // Ending the shift also ends an open route, so the run is saved.
      if (next === 'off-duty' && runActive) endRoute()
      toast(next === 'on-shift' ? 'Shift started' : 'Shift ended')
    })
  }

  return (
    <div className="m-page">
      <div>
        <h1 className="m-h1">My Profile</h1>
        <p className="m-muted">My truck and my work today</p>
      </div>

      <section className="m-card m-card--accent m-row">
        <span className="ct-avatar" style={{ width: 52, height: 52, fontSize: 16 }}>
          {driver.initials}
        </span>
        <div className="m-grow">
          <strong>{driver.name}</strong>
          <p className="m-muted">
            <span className="ct-mono">{driver.id}</span>{r.data.settings.barangayName ? ` · ${r.data.settings.barangayName}` : ''}
          </p>
          <div className="m-row drv-gap" style={{ flexWrap: 'wrap', gap: 6 }}>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <span className="ct-tag">
              <IdCard size={11} /> {driver.license}
            </span>
          </div>
        </div>
      </section>

      <section className="m-card">
        <div className="m-row m-row--between">
          <strong>
            <Truck size={14} /> My Truck Today
          </strong>
          <StatusBadge tone={truckStatusMeta[truck.status].tone}>{truckStatusMeta[truck.status].label}</StatusBadge>
        </div>
        {assigned ? (
          <>
            <div className="m-box-grid drv-gap">
              <div className="m-box">
                <small>Truck</small>
                <strong>{truck.id}</strong>
                <span className="m-muted">Garbage truck</span>
              </div>
              <div className="m-box">
                <small>Plate number</small>
                <strong className="ct-mono">{truck.plateNumber}</strong>
              </div>
            </div>
            <div className="m-box drv-gap">
              <small>
                <RouteIcon size={10} /> My route
              </small>
              <strong>{route.name}</strong>
            </div>
          </>
        ) : (
          <p className="m-muted drv-gap">You are not driving {truck.id} today.</p>
        )}
      </section>

      <section className="m-card">
        <div className="m-row m-row--between">
          <strong>My Work Today</strong>
          <span className="m-muted">{driver.shift}</span>
        </div>
        <div className="m-box-grid drv-gap">
          <div className="m-box">
            <small>Stops done</small>
            <strong className="m-big">
              {summary.collected}
              <small> / {summary.total}</small>
            </strong>
            <div className="ct-progress">
              <span style={{ width: `${summary.percent}%` }} />
            </div>
          </div>
          <div className="m-box">
            <small>Households served</small>
            <strong className="m-big">
              {r.collectedHouseholds}
              <small> / {r.totalHouseholds}</small>
            </strong>
          </div>
        </div>
        {onShift ? (
          <button type="button" className="ct-btn ct-btn--secondary ct-btn--block drv-gap" onClick={() => setShift('off-duty')}>
            <Square size={14} /> End My Shift
          </button>
        ) : (
          <button type="button" className="ct-btn ct-btn--primary ct-btn--block drv-gap" onClick={() => setShift('on-shift')}>
            <Play size={15} /> Start My Shift
          </button>
        )}
      </section>

      <section className="m-card">
        <strong>Need Help?</strong>
        <a className="m-box m-row drv-gap" href={tel(barangay.hotline)}>
          <Headset size={16} />
          <span className="m-grow">
            <small>Barangay office</small>
            <strong>{barangay.hotline}</strong>
          </span>
          <Phone size={14} />
        </a>
        <a className="m-box m-row drv-gap" href="tel:911">
          <Siren size={16} color="var(--ct-red-600)" />
          <span className="m-grow">
            <small>Emergency</small>
            <strong>911 / Tanod {barangay.tanodHotline}</strong>
          </span>
          <Phone size={14} />
        </a>
      </section>

      <p className="m-muted" style={{ textAlign: 'center' }}>
        CleanTrack Driver · demo app (the truck location is simulated)
      </p>
      <button type="button" className="ct-btn ct-btn--secondary ct-btn--block" onClick={() => setPwOpen(true)}>
        <KeyRound size={15} /> Change Password
      </button>
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      <SignOutButton role="driver" label="Sign Out" />
    </div>
  )
}

