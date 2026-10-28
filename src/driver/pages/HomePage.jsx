import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, Headset, Info, Navigation, Pause, Play, Route as RouteIcon, TriangleAlert, Truck } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import NotAssignedCard from '../components/NotAssignedCard.jsx'
import { useRouteActions } from '../components/useRouteActions.js'
import { useDriverRoute } from '../components/useDriverRoute.js'
import { formatTime } from '../../utils/format.js'
import { scheduleLabel } from '../../data/schedule.js'
import MyCrewCard from '../components/MyCrewCard.jsx'
import Avatar from '../../components/Avatar.jsx'
import './DriverPages.css'

// Driver Home: greeting, Start Route, Today's Progress, Report a Problem, Call the Office.
export default function HomePage() {
  const r = useDriverRoute()
  const { driver, truck, route, state, summary, assigned } = r
  const firstName = driver.name.split(' ')[0]
  const { runActive, moving, blocked, startRoute } = useRouteActions(r)
  const [starting, setStarting] = useState(false)
  const lastRun = r.run && !runActive ? r.run : null // today's run that already ended
  const shiftDone = lastRun?.status === 'completed'
  const notDone = summary.pending + summary.next
  const officePhone = r.data.settings.officePhone ?? ''

  function onStart() {
    if (starting) return
    setStarting(true)
    startRoute().finally(() => setStarting(false))
  }

  return (
    <div className="m-page">
      {/* 1. Greeting and driver details */}
      <section className="m-card">
        <div className="m-row">
          <Avatar photo={driver.photo} initials={driver.initials} name={driver.name} />
          <div className="m-grow">
            <strong>Kumusta, {firstName}!</strong>
            <p className="m-muted">
              {driver.name} · <span className="ct-mono">{driver.id}</span>
            </p>
            {driver.shift && <p className="m-muted">{driver.shift}</p>}
          </div>
        </div>
        <div className="m-box-grid drv-gap">
          <div className="m-box">
            <small>Your truck</small>
            <strong>
              <Truck size={12} /> {truck.id} ({truck.plateNumber})
            </strong>
          </div>
          <div className="m-box">
            <small>Your route</small>
            <strong>
              <RouteIcon size={12} /> {route.shortName}
            </strong>
          </div>
        </div>
      </section>

      {!assigned && <NotAssignedCard truckId={truck.id} />}

      {/* 2. Start Route (or the route's current status) */}
      {blocked && assigned && (
        <div className="ct-alert ct-alert--warning" role="alert">
          <TriangleAlert size={16} />
          <span>{blocked}</span>
        </div>
      )}

      {shiftDone ? (
        <section className="m-card drv-done m-row" role="status">
          <CircleCheck size={22} />
          <div className="m-grow">
            <strong>Shift ended</strong>
            <p className="m-muted">All stops done. Route saved at {formatTime(lastRun.endedAt)}.</p>
          </div>
        </section>
      ) : runActive && moving ? (
        <section className="m-card drv-live">
          <div className="m-row m-row--between">
            <strong>
              <Navigation size={14} /> Route in progress
            </strong>
            <StatusBadge tone={state.status === 'paused' ? 'amber' : 'green'}>{state.status === 'paused' ? 'On a break' : 'Driving'}</StatusBadge>
          </div>
          <div className="m-box-grid drv-gap">
            <Link to="/driver/route" className="ct-btn ct-btn--primary">
              Open My Route <ArrowRight size={15} />
            </Link>
            {state.status === 'paused' ? (
              <button type="button" className="ct-btn ct-btn--secondary" onClick={r.resume}>
                <Play size={15} /> Continue
              </button>
            ) : (
              <button type="button" className="ct-btn ct-btn--secondary" onClick={r.pause}>
                <Pause size={15} /> Take a break
              </button>
            )}
          </div>
        </section>
      ) : (
        assigned && (
          <button type="button" className="drv-start" onClick={onStart} disabled={Boolean(blocked) || starting} aria-busy={starting}>
            <span className="m-icon">
              <Play size={16} />
            </span>
            <span>
              {starting ? 'Starting…' : runActive ? 'Continue Route' : 'Start Route'}
              <small>
                {runActive
                  ? 'Your route is still open'
                  : lastRun
                    ? 'Your last trip ended early. Start a new trip.'
                    : 'Starts today’s collection (demo truck on the map)'}
              </small>
            </span>
            <ArrowRight size={18} />
          </button>
        )
      )}

      {/* 3. Today's progress (from saved stop records) */}
      <section className="m-card" aria-labelledby="drv-progress-title">
        <div className="m-row m-row--between">
          <strong id="drv-progress-title">Today&apos;s Progress</strong>
          <StatusBadge tone={summary.collected === summary.total && summary.total ? 'green' : 'gray'}>{summary.percent}% done</StatusBadge>
        </div>
        <p className="m-big drv-gap">
          {summary.collected}/{summary.total}
          <small> stops completed</small>
        </p>
        <div
          className="ct-progress drv-gap"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={summary.total}
          aria-valuenow={summary.collected}
          aria-label="Stops collected"
        >
          <span style={{ width: `${summary.percent}%` }} />
        </div>
        <p className="m-muted drv-gap">
          {notDone} to go
          {summary.missed > 0 && ` · ${summary.missed} could not pick up`}
        </p>
        <div className="m-box drv-gap">
          <small>Today&apos;s pickup</small>
          <strong>{r.collectionToday ? `Collection day · ${r.todaysRun?.window}` : `No collection today (${scheduleLabel} only)`}</strong>
        </div>
      </section>

      <MyCrewCard crew={r.crew} assigned={assigned} compact />

      {/* 4 + 5. Report a Problem / Call the Office */}
      <div className="m-actions">
        {assigned ? (
          <Link to="/driver/report" className="m-action">
            <span className="m-icon m-icon--red">
              <TriangleAlert size={16} />
            </span>
            <strong>Report a Problem</strong>
            <small>Road blocked, truck problem</small>
          </Link>
        ) : (
          <div className="m-action is-disabled" aria-disabled="true">
            <span className="m-icon m-icon--red">
              <TriangleAlert size={16} />
            </span>
            <strong>Report a Problem</strong>
            <small>Only for the assigned driver</small>
          </div>
        )}
        {officePhone ? (
          <a href={`tel:${officePhone.replace(/[^\d+]/g, '')}`} className="m-action">
            <span className="m-icon">
              <Headset size={16} />
            </span>
            <strong>Call the Office</strong>
            <small>{officePhone}</small>
          </a>
        ) : (
          <div className="m-action is-disabled" aria-disabled="true">
            <span className="m-icon">
              <Headset size={16} />
            </span>
            <strong>Call the Office</strong>
            <small>No office number yet. The admin can add it in Settings.</small>
          </div>
        )}
      </div>

      <p className="m-muted drv-footnote">
        <Info size={11} /> Demo app: the truck location on the map is simulated.
      </p>
    </div>
  )
}
