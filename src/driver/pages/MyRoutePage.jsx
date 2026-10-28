import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, Flag, Info, MapPin, RotateCcw, TriangleAlert } from 'lucide-react'
import TrackingMap from '../../components/map/TrackingMap.jsx'
import ErrorBoundary from '../../components/ErrorBoundary.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Modal from '../../components/Modal.jsx'
import Celebration from '../../components/Celebration.jsx'
import { celebrateOnce } from '../../data/residentMessages.js'
import { scheduleLabel } from '../../data/schedule.js'
import NotAssignedCard from '../components/NotAssignedCard.jsx'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { useRouteActions } from '../components/useRouteActions.js'
import { useToast } from '../../components/toast/toastContext.js'
import { formatTime } from '../../utils/format.js'
import { plainStopStatus, plainTruckState } from '../../data/plainWords.js'
import './DriverPages.css'

// My Route: fixed progress bar, map, then the stops as a queue (the stop to do
// now is always on top; finished stops move to the bottom).
export default function MyRoutePage() {
  const r = useDriverRoute()
  const toast = useToast()
  const [params] = useSearchParams()
  const { route, state, progress, stops, summary, truck, queue, driver, assigned, allCollected } = r
  const { runActive, endShift } = useRouteActions(r)
  const [confirm, setConfirm] = useState(null) // { kind: 'collect' | 'undo' | 'end', item? }
  const [saving, setSaving] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const savingRef = useRef(false)
  const shiftDone = !runActive && r.run?.status === 'completed'
  // Nothing left in the normal order, but some stops still need a return visit.
  const onlyRetryLeft = !queue.active && queue.retry.length > 0

  // A link like /driver/route?stop=STP-04 scrolls to that stop.
  const focusId = params.get('stop')
  useEffect(() => {
    if (focusId) document.getElementById(`stop-${focusId}`)?.scrollIntoView({ block: 'center' })
  }, [focusId])

  // Runs one save at a time, so repeated taps never send twice.
  function save(action, done) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    action().then((res) => {
      savingRef.current = false
      setSaving(false)
      setConfirm(null)
      if (res?.ok) done?.()
    })
  }

  // Marks the stop as done (a route record only; no bag counts or resident data).
  function collect(item) {
    const runId = r.run?.id
    const isLast = stops.every((s) => s.status === 'collected' || s.stop.id === item.stop.id)
    save(
      () => r.dispatch({ type: 'collection/mark', payload: { stopId: item.stop.id, status: 'collected', by: 'driver', byName: driver.name } }),
      () => {
        // Confetti once per route, only right after the last stop is saved.
        if (isLast && runId && celebrateOnce(`route-${runId}`)) setCelebrating(true)
        else toast(`Stop #${item.number} collected ✔`)
      },
    )
  }

  function undo(item) {
    save(
      () => r.dispatch({ type: 'collection/clear', payload: { stopId: item.stop.id } }),
      () => toast(`Stop #${item.number} is back in the list`),
    )
  }

  const askCollect = (item) => setConfirm({ kind: 'collect', item })

  return (
    <div className="m-page drv-route">
      {/* 1. Fixed progress (stays under the header while scrolling) */}
      <div className="drv-progress-bar" role="status" aria-live="polite">
        <div className="m-row m-row--between">
          <strong>
            Progress: {summary.collected}/{summary.total}
          </strong>
          <span className="m-muted">
            {summary.missed > 0 ? `${summary.missed} could not pick up · ` : ''}
            {summary.percent}%
          </span>
        </div>
        <div className="ct-progress" aria-hidden="true">
          <span style={{ width: `${summary.percent}%` }} />
        </div>
      </div>

      {!assigned && <NotAssignedCard truckId={truck.id} />}

      {/* 2. Map */}
      <section className="m-card m-card--flush">
        <div className="m-row m-row--between drv-map-head">
          <strong>{route.shortName}</strong>
          <StatusBadge tone="amber">Simulated GPS · {plainTruckState[state.status]}</StatusBadge>
        </div>
        {r.error ? (
          <p className="ct-empty">{r.error}</p>
        ) : (
          <ErrorBoundary fallback={<p className="ct-empty">The map could not load.</p>}>
            <TrackingMap className="m-map" route={route} state={state} progress={progress} truckLabel={truck.id} />
          </ErrorBoundary>
        )}
      </section>

      {/* 3. Stops in order (queue) */}
      <div className="m-row m-row--between">
        <h2 className="m-section-title">Stops in Order</h2>
        <span className="m-muted">{queue.upcoming.length + (queue.active ? 1 : 0)} to go</span>
      </div>

      {!r.collectionToday && !runActive && (
        <div className="ct-alert" role="status">
          <Info size={16} />
          <span>No collection today. Regular routes run on {scheduleLabel} only. Your stops are shown for reference.</span>
        </div>
      )}

      {assigned && r.collectionToday && !runActive && !shiftDone && !allCollected && (
        <div className="ct-alert" role="status">
          <Info size={16} />
          <span>
            Start your route on <Link to="/driver">Home</Link> first, then mark each stop here.
          </span>
        </div>
      )}

      {queue.active && (
        <article id={`stop-${queue.active.stop.id}`} className="m-card drv-stop is-next drv-stop--active">
          <span className="drv-stop__num">{queue.active.number}</span>
          <div className="m-grow">
            <StatusBadge tone="green">
              <MapPin size={11} /> Go here now
            </StatusBadge>
            <h3 className="drv-stop__name">{queue.active.stop.name}</h3>
            <p className="m-muted">
              {queue.active.stop.purok}
            </p>
            {progress?.waitingAt === queue.active.stop.id && <p className="drv-waiting">The truck is here.</p>}
            <button
              type="button"
              className="ct-btn ct-btn--primary ct-btn--block drv-gap"
              disabled={!assigned || !runActive || saving}
              onClick={() => askCollect(queue.active)}
            >
              <CircleCheck size={16} /> Mark as Collected
            </button>
            {assigned && (
              <Link to={`/driver/report?stop=${queue.active.stop.id}&from=route`} className="drv-text-link">
                <TriangleAlert size={13} /> Problem at this stop?
              </Link>
            )}
          </div>
        </article>
      )}

      {queue.upcoming.map((s, i) => (
        <article key={s.stop.id} id={`stop-${s.stop.id}`} className="m-card drv-stop drv-stop--compact">
          <span className="drv-stop__num">{s.number}</span>
          <div className="m-grow">
            <strong>{s.stop.name}</strong>
            <p className="m-muted">
              {s.stop.purok}
            </p>
          </div>
          <StatusBadge tone="gray">{i === 0 ? 'Up next' : 'Not yet'}</StatusBadge>
        </article>
      ))}

      {queue.retry.length > 0 && (
        <>
          <div className="m-row m-row--between drv-gap">
            <h2 className="m-section-title">Go Back to These Stops</h2>
            <span className="m-muted">{queue.retry.length}</span>
          </div>
          {onlyRetryLeft && (
            <div className="ct-alert ct-alert--warning" role="status">
              <TriangleAlert size={16} />
              <span>Almost done! Collect these stops to finish your route. If you cannot, please call the office.</span>
            </div>
          )}
          {queue.retry.map((s) => (
            <article key={s.stop.id} id={`stop-${s.stop.id}`} className="m-card drv-stop is-missed">
              <span className="drv-stop__num">{s.number}</span>
              <div className="m-grow">
                <div className="m-row m-row--between m-row--top">
                  <strong>{s.stop.name}</strong>
                  <StatusBadge tone="red">{plainStopStatus.missed.label}</StatusBadge>
                </div>
                <p className="m-muted">{s.stop.purok}</p>
                {s.log?.note && <p className="drv-note">{s.log.note}</p>}
                <button
                  type="button"
                  className="ct-btn ct-btn--secondary ct-btn--block drv-gap"
                  disabled={!assigned || !runActive || saving}
                  onClick={() => askCollect(s)}
                >
                  <CircleCheck size={16} /> Mark as Collected
                </button>
              </div>
            </article>
          ))}
        </>
      )}

      {allCollected && (
        <section className="m-card drv-finish" role="status">
          <CircleCheck size={28} />
          {shiftDone ? (
            <>
              <strong>Shift ended</strong>
              <p className="m-muted">Your route was saved at {formatTime(r.run.endedAt)}. Thank you!</p>
            </>
          ) : (
            <>
              <strong>Route complete! All stops collected.</strong>
              <p className="m-muted">
                {summary.collected} of {summary.total} stops collected. You can end your shift now.
              </p>
              {runActive && (
                <button type="button" className="ct-btn ct-btn--primary ct-btn--block drv-gap drv-end-shift" disabled={saving} onClick={() => setConfirm({ kind: 'end' })}>
                  <Flag size={16} /> END MY SHIFT
                </button>
              )}
            </>
          )}
        </section>
      )}

      {stops.length === 0 && <div className="m-card ct-empty">There are no stops on this route.</div>}

      {queue.done.length > 0 && (
        <>
          <div className="m-row m-row--between drv-gap">
            <h2 className="m-section-title">Completed Stops</h2>
            <span className="m-muted">{queue.done.length}</span>
          </div>
          {queue.done.map((s) => {
            const meta = plainStopStatus[s.status]
            const canUndo = assigned && runActive && s.log?.by === 'driver' && s.status === 'collected'
            return (
              <article key={s.stop.id} id={`stop-${s.stop.id}`} className={`m-card drv-stop drv-stop--compact is-${s.status}`}>
                <span className="drv-stop__num">{s.number}</span>
                <div className="m-grow">
                  <strong>{s.stop.name}</strong>
                  <p className="m-muted">
                    {s.stop.purok}
                    {s.log && ` · ${formatTime(s.log.at)}`}
                  </p>
                </div>
                <div className="drv-stop__side">
                  <StatusBadge tone={meta.tone}>{s.status === 'collected' ? 'Collected' : meta.label}</StatusBadge>
                  {canUndo && (
                    <button type="button" className="drv-text-link" disabled={saving} onClick={() => setConfirm({ kind: 'undo', item: s })}>
                      <RotateCcw size={12} /> Undo
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </>
      )}

      <p className="m-muted drv-footnote">Demo app: the map and truck location are simulated, not live GPS.</p>

      {celebrating && (
        <Celebration title="Route Complete! 🎉" message="Great job, team! Every stop is collected." onDone={() => setCelebrating(false)} />
      )}

      {confirm?.kind === 'collect' && (
        <Modal
          title={`Done at Stop #${confirm.item.number}?`}
          icon={CircleCheck}
          onClose={() => !saving && setConfirm(null)}
          footer={
            <>
              <button type="button" className="ct-btn ct-btn--secondary" disabled={saving} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="ct-btn ct-btn--primary" disabled={saving} onClick={() => collect(confirm.item)}>
                {saving ? 'Saving…' : 'Yes, collected'}
              </button>
            </>
          }
        >
          <p>
            Did you finish collecting the garbage at <strong>{confirm.item.stop.name}</strong> ({confirm.item.stop.purok})?
          </p>
        </Modal>
      )}

      {confirm?.kind === 'undo' && (
        <Modal
          title={`Undo Stop #${confirm.item.number}?`}
          icon={RotateCcw}
          onClose={() => !saving && setConfirm(null)}
          footer={
            <>
              <button type="button" className="ct-btn ct-btn--secondary" disabled={saving} onClick={() => setConfirm(null)}>
                Keep it
              </button>
              <button type="button" className="ct-btn ct-btn--danger-solid" disabled={saving} onClick={() => undo(confirm.item)}>
                Undo
              </button>
            </>
          }
        >
          <p>
            <strong>{confirm.item.stop.name}</strong> will go back to the list of stops to do.
          </p>
        </Modal>
      )}

      {confirm?.kind === 'end' && (
        <Modal
          title="End your shift?"
          icon={Flag}
          onClose={() => !saving && setConfirm(null)}
          footer={
            <>
              <button type="button" className="ct-btn ct-btn--secondary" disabled={saving} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="ct-btn ct-btn--primary" disabled={saving} onClick={() => save(endShift)}>
                {saving ? 'Saving…' : 'Yes, end my shift'}
              </button>
            </>
          }
        >
          <p>
            Your route will be saved as finished ({summary.collected} of {summary.total} collected) and the office will see it.
          </p>
        </Modal>
      )}
    </div>
  )
}
