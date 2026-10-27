import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BellRing, Crosshair, House, Info, Play, RefreshCw, TriangleAlert, Truck } from 'lucide-react'
import TrackingMap from '../../components/map/TrackingMap.jsx'
import MapLegend from '../../components/map/MapLegend.jsx'
import ErrorBoundary from '../../components/ErrorBoundary.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import ToggleRow from '../../components/ToggleRow.jsx'
import { useTruckForResident } from '../components/useTruckForResident.js'
import { useData } from '../../store/dataContext.js'
import { STATUS_LABELS, STATUS_TONES } from '../../services/trackingSimulation.js'
import { formatTime } from '../../utils/format.js'
import './ResidentPages.css'

// PDF page 37
export default function TrackTruckPage() {
  const t = useTruckForResident()
  const { dispatch } = useData()
  const { data, resident, route, state, progress } = t
  const truck = data.truck
  const driver = data.drivers.find((d) => d.id === truck.driverId)
  const [focus, setFocus] = useState(null)
  function setPref(value) {
    dispatch({ type: 'resident/update', payload: { id: resident.id, patch: { prefs: { ...resident.prefs, truckNearby: value } } } })
  }

  const nearAlert = resident.prefs.truckNearby && (t.distance.state === 'here' || (t.distance.state === 'approaching' && t.distance.stopsAway === 0))

  return (
    <div className="m-page">
      <header className="m-subhead">
        <Link to="/resident" className="ct-icon-btn" aria-label="Back to home">
          <ArrowLeft size={18} />
        </Link>
        <div className="m-grow">
          <h1>Where is the Truck?</h1>
          <p>Demo truck location</p>
        </div>
        <StatusBadge tone={STATUS_TONES[state.status]}>{STATUS_LABELS[state.status]}</StatusBadge>
      </header>

      <div className="ct-alert ct-alert--warning">
        <Info size={15} />
        <span>
          <strong>Demo only:</strong> this is a practice truck, not the real truck location.
        </span>
      </div>

      {nearAlert && (
        <div className="ct-alert res-near" role="status">
          <BellRing size={16} />
          <span>
            <strong>Almost here!</strong> The truck is coming to {resident.purok}. Please bring out your trash now.
          </span>
        </div>
      )}

      <section className="m-card m-card--flush">
        {t.error ? (
          <p className="ct-empty">{t.error}</p>
        ) : (
          <div className="res-map-wrap">
            <ErrorBoundary fallback={<p className="ct-empty">The map could not load.</p>}>
              <TrackingMap className="m-map m-map--tall" route={route} state={state} progress={progress} focusRequest={focus} truckLabel={truck.id} />
            </ErrorBoundary>
            <button type="button" className="ct-btn ct-btn--secondary res-map-btn" onClick={() => setFocus({ type: 'truck', id: Date.now() })}>
              <Crosshair size={14} /> Find truck
            </button>
          </div>
        )}
        <div className="res-card-head">
          <MapLegend plain />
        </div>
      </section>

      {state.status === 'idle' && (
        <section className="m-card res-demo">
          <p className="m-muted">
            The truck has not left yet. (Normally the driver starts it.)
          </p>
          <button type="button" className="ct-btn ct-btn--soft ct-btn--block" onClick={t.start}>
            <Play size={15} /> Demo: start the truck
          </button>
        </section>
      )}

      <section className="m-card">
        <div className="m-row">
          <span className="m-icon">
            <Truck size={16} />
          </span>
          <div className="m-grow">
            <strong>Truck {truck.id}</strong>
            <p className="m-muted">Garbage truck</p>
          </div>
          <StatusBadge tone={t.tone}>{t.label}</StatusBadge>
        </div>
        <div className="m-box res-gap m-row m-row--between">
          <span>{driver?.name ?? 'No driver yet'}</span>
          <strong>{route.shortName}</strong>
        </div>
        <div className="m-box-grid res-gap">
          <div className="m-box">
            <small>Your area</small>
            <strong className="m-big">{resident.purok}</strong>
            <span className="m-muted">{t.distance.stop?.name ?? 'Not on the route'}</span>
          </div>
          <div className="m-box">
            <small>Stops done</small>
            <strong className="m-big">
              {progress?.collected ?? 0}
              <small> / {progress?.total ?? 0}</small>
            </strong>
            <div className="ct-progress">
              <span style={{ width: `${progress?.percent ?? 0}%` }} />
            </div>
          </div>
        </div>
        <p className="m-muted res-gap">
          <RefreshCw size={11} /> Updated: {state.updatedAt ? formatTime(state.updatedAt) : 'waiting for the truck to leave'}
        </p>
      </section>

      <section className="m-card">
        <p className="m-eyebrow">Alert</p>
        <ToggleRow
          icon={BellRing}
          label="Tell me when the truck is near"
          hint="A message will show on this screen."
          checked={resident.prefs.truckNearby}
          onChange={setPref}
        />
        <Link to="/resident/reports/new?category=no-truck" className="ct-btn ct-btn--secondary ct-btn--block res-gap">
          <TriangleAlert size={15} color="var(--ct-red-600)" /> Truck is late? Tell us
        </Link>
      </section>

      <Link to="/resident" className="ct-btn ct-btn--primary ct-btn--block">
        <House size={16} /> Back to Home
      </Link>
    </div>
  )
}
