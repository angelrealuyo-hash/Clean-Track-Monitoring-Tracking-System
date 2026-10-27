import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, Info, MapPin, Minus, Package, Plus, RotateCcw, TriangleAlert } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import NotAssignedCard from '../components/NotAssignedCard.jsx'
import DriverIssueForm from '../components/DriverIssueForm.jsx'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { useToast } from '../../components/toast/toastContext.js'
import { plainStopStatus as stopStatusMeta, plainWaste } from '../../data/plainWords.js'
import { formatTime } from '../../utils/format.js'
import './DriverPages.css'

// PDF page 47 (stop details + report a problem)
export default function CollectionPage() {
  const r = useDriverRoute()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { stops, target, assigned, driver, truck, dispatch } = r
  const current = stops.find((s) => s.stop.id === params.get('stop')) ?? target ?? stops[0]
  const reporting = params.get('report') === '1'
  const [bags, setBags] = useState(current?.stop.households ?? 0)
  // Reset the bag count when switching stops (adjust state during render).
  const [bagsFor, setBagsFor] = useState(current?.stop.id)
  if (current && bagsFor !== current.stop.id) {
    setBagsFor(current.stop.id)
    setBags(current.stop.households)
  }

  if (!current) return <div className="m-page"><div className="m-card ct-empty">There are no stops on this route.</div></div>

  const go = (stopId, extra = {}) => setParams({ stop: stopId, ...extra }, { replace: true })
  const meta = stopStatusMeta[current.status]
  const notes = r.data.notifications.filter((n) => n.audience === 'driver' && n.link?.to.includes(current.stop.id))

  function markCollected() {
    dispatch({ type: 'collection/mark', payload: { stopId: current.stop.id, status: 'collected', note: `${bags} bags`, by: 'driver', byName: driver.name, bags } }).then((res) => {
      if (!res.ok) return
      toast(`Stop #${current.number} done ✔`)
      const after = stops.find((s) => s.number > current.number && (s.status === 'pending' || s.status === 'next'))
      if (after) go(after.stop.id)
    })
  }

  if (reporting) {
    return (
      <DriverIssueForm
        stop={current.stop}
        number={current.number}
        driverName={driver.name}
        onCancel={() => go(current.stop.id)}
        onSubmit={(issue) => {
          dispatch({ type: 'driver/reportIssue', payload: issue }).then((res) => {
            if (!res.ok) return
            toast(issue.notifyDispatch ? 'Sent to the office' : 'Saved: could not pick up here')
            go(current.stop.id)
          })
        }}
      />
    )
  }

  return (
    <div className="m-page">
      <div className="m-row m-row--between">
        <strong>
          Stop #{current.number} of {stops.length}
        </strong>
        <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      </div>

      {!assigned && <NotAssignedCard truckId={truck.id} />}

      <label className="ct-field">
        <span className="ct-label">Choose a stop</span>
        <select className="ct-input" value={current.stop.id} onChange={(e) => go(e.target.value)}>
          {stops.map((s) => (
            <option key={s.stop.id} value={s.stop.id}>
              #{s.number} {s.stop.name} ({stopStatusMeta[s.status].label})
            </option>
          ))}
        </select>
      </label>

      <section className="m-card">
        <p className="m-eyebrow">Stop</p>
        <h1 className="m-h1">
          {current.stop.purok} · {current.stop.name}
        </h1>
        <div className="m-box-grid drv-gap">
          <div className="m-box">
            <small>Order</small>
            <strong>
              Stop {current.number} of {stops.length}
            </strong>
          </div>
          <div className="m-box">
            <small>Households here</small>
            <strong>
              <Package size={12} /> about {current.stop.households}
            </strong>
          </div>
        </div>
        <div className="m-box drv-gap">
          <small>Today&apos;s trash</small>
          <strong>{plainWaste(r.todaysRun?.wasteType)}</strong>
        </div>
        <p className="m-muted drv-gap">
          <MapPin size={11} /> Demo app: the truck location is simulated.
        </p>
      </section>

      {notes.map((n) => (
        <div key={n.id} className="ct-alert">
          <Info size={15} />
          <span>
            <strong>Message from the office:</strong> {n.body}
          </span>
        </div>
      ))}

      {current.status === 'collected' ? (
        <section className="m-card drv-done m-row">
          <CircleCheck size={20} />
          <div className="m-grow">
            <strong>Done ✔</strong>
            <p className="m-muted">{current.log ? `${current.log.note} · ${formatTime(current.log.at)}` : 'Picked up'}</p>
          </div>
          {current.log && (
            <button
              type="button"
              className="ct-btn ct-btn--secondary"
              onClick={() => {
                dispatch({ type: 'collection/clear', payload: { stopId: current.stop.id } }).then((res) => {
                  if (!res.ok) return
                  toast('Undone')
                })
              }}
            >
              <RotateCcw size={14} /> Undo
            </button>
          )}
        </section>
      ) : (
        <>
          {current.status === 'missed' && current.log?.note && <p className="drv-note">Reported: {current.log.note}</p>}
          <section className="m-card">
            <div className="m-row m-row--between">
              <div>
                <strong>How many bags?</strong>
                <p className="m-muted">Garbage bags you picked up (estimate is fine)</p>
              </div>
              <div className="drv-counter">
                <button type="button" aria-label="One less" onClick={() => setBags((b) => Math.max(0, b - 1))}>
                  <Minus size={16} />
                </button>
                <output aria-live="polite" aria-label="Bags collected">
                  {bags}
                </output>
                <button type="button" aria-label="One more" onClick={() => setBags((b) => Math.min(200, b + 1))}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </section>
          <button type="button" className="ct-btn ct-btn--primary ct-btn--block" disabled={!assigned} onClick={markCollected}>
            <CircleCheck size={16} /> Mark as Collected
          </button>
        </>
      )}

      <button
        type="button"
        className="ct-btn ct-btn--secondary ct-btn--block"
        disabled={!assigned}
        onClick={() => go(current.stop.id, { report: '1' })}
      >
        <TriangleAlert size={15} color="var(--ct-red-600)" /> Report a Problem Here
      </button>
      <Link to="/driver/route" className="ct-btn ct-btn--secondary ct-btn--block">
        Back to My Route
      </Link>
    </div>
  )
}
