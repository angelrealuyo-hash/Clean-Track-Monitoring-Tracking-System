import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleX, Info, MapPin, SkipForward, Truck } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import ToggleRow from '../../components/ToggleRow.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { barangay } from '../../data/barangay.js'
import { dayOfDate, exceptionKinds, scheduleLabel } from '../../data/schedule.js'
import { calendarLegend, dayStatus } from '../../data/calendarStatus.js'
import { feedbackReasonLabel } from '../../data/collectionFeedback.js'
import { formatDate, localDateISO, todayISO } from '../../utils/format.js'
import './ResidentPages.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ICONS = { scheduled: Truck, done: CircleCheck, skipped: SkipForward, missed: CircleX, holiday: CircleAlert }
const TONES = { scheduled: 'green', done: 'green', skipped: 'gray', missed: 'red', holiday: 'amber' }
const LEGEND_ORDER = ['scheduled', 'done', 'skipped', 'missed', 'holiday']

const iso = (y, m, d) => localDateISO(new Date(y, m, d))
const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

// Pickup Days: a month calendar with an icon on each pickup day, from saved
// records (the resident's Pick Up Check answers and the admin's holidays).
export default function SchedulePage() {
  const { data, dispatch } = useData()
  const resident = useResident()
  const today = todayISO()
  const [view, setView] = useState(() => {
    const d = new Date(`${today}T00:00`)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [selected, setSelected] = useState(today)

  // Days a Pick Up Check was sent (from the saved notifications).
  const checkDates = new Set(data.notifications.filter((n) => n.kind === 'pickup-check' && n.key).map((n) => n.key.replace('pickup-check-', '')))
  const ctx = {
    today,
    exceptions: data.scheduleExceptions ?? [],
    feedback: data.collectionFeedback ?? [],
    checkDates,
    since: resident.createdAt ? localDateISO(resident.createdAt) : '',
  }

  // Calendar cells: blanks before the 1st, then each day of the month.
  const first = new Date(view.y, view.m, 1).getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => iso(view.y, view.m, i + 1))]
  const move = (delta) => setView(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }))
  const goToday = () => {
    const d = new Date(`${today}T00:00`)
    setView({ y: d.getFullYear(), m: d.getMonth() })
    setSelected(today)
  }

  const sel = dayStatus(selected, ctx)
  const pickupWindow = data.weeklySchedule.find((d) => d.day === dayOfDate(selected))?.window

  function setReminders(value) {
    dispatch({ type: 'resident/update', payload: { id: resident.id, patch: { prefs: { ...resident.prefs, scheduleReminders: value } } } })
  }

  return (
    <div className="m-page">
      <div>
        <h1 className="m-h1">Pickup Days</h1>
        <p className="m-muted">
          <MapPin size={11} /> {resident.purok}
        </p>
      </div>

      <div className="ct-alert">
        <CalendarDays size={15} />
        <span>
          The garbage truck comes on <strong>{scheduleLabel}</strong> only. Put your tied garbage bags out before the pickup time.
        </span>
      </div>

      <section className="m-card res-cal" aria-label="Pickup calendar">
        <div className="res-cal__head">
          <button type="button" className="ct-icon-btn" onClick={() => move(-1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <strong aria-live="polite">{monthName(view.y, view.m)}</strong>
          <button type="button" className="ct-icon-btn" onClick={() => move(1)} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
        <button type="button" className="res-cal__today" onClick={goToday}>
          Today
        </button>

        <div className="res-cal__grid" role="grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="res-cal__wd" role="columnheader">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} aria-hidden="true" />
            const st = dayStatus(d, ctx)
            const Icon = st ? ICONS[st.status] : null
            const label = `${formatDate(d)}${d === today ? ' (today)' : ''}: ${st ? calendarLegend[st.status] : 'No pickup'}`
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                className={`res-cal__day ${st ? `is-${st.status}` : 'is-none'} ${d === today ? 'is-today' : ''} ${d === selected ? 'is-selected' : ''}`}
                aria-label={label}
                aria-selected={d === selected}
                title={label}
                onClick={() => setSelected(d)}
              >
                <span className="res-cal__num">{Number(d.slice(8))}</span>
                {Icon && <Icon size={15} aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        <ul className="res-cal__legend" aria-label="What the icons mean">
          {LEGEND_ORDER.map((k) => {
            const Icon = ICONS[k]
            return (
              <li key={k} className={`is-${k}`}>
                <Icon size={14} aria-hidden="true" /> {calendarLegend[k]}
              </li>
            )
          })}
        </ul>
      </section>

      {/* The chosen date */}
      <section className="m-card" aria-live="polite">
        <div className="m-row m-row--between">
          <strong>
            {formatDate(selected)} · {dayOfDate(selected)}
          </strong>
          {selected === today && <StatusBadge tone="blue">Today</StatusBadge>}
        </div>
        {!sel ? (
          <p className="m-muted res-gap">No pickup on this day. Pickup days are {scheduleLabel}.</p>
        ) : (
          <>
            <p className="res-gap">
              <StatusBadge tone={TONES[sel.status]}>{calendarLegend[sel.status]}</StatusBadge>
            </p>
            {sel.status === 'holiday' ? (
              <p className="m-muted">
                {exceptionKinds[sel.exception.kind]}: {sel.exception.reason}. The truck does not come on this day.
              </p>
            ) : (
              <p className="m-muted">
                <Truck size={11} /> Truck {data.truck.id} · pickup {pickupWindow}
              </p>
            )}
            {sel.answer && (
              <ul className="res-fb-summary">
                <li>Planning to dispose: {sel.answer.willDispose ? 'Yes' : 'No'}</li>
                {sel.answer.truckPassed !== null && <li>Truck passed your location: {sel.answer.truckPassed ? 'Yes' : 'No'}</li>}
                {sel.answer.disposed !== null && <li>Able to dispose: {sel.answer.disposed ? 'Yes' : 'No'}</li>}
                {sel.answer.reason && <li>Reason: {feedbackReasonLabel(sel.answer.reason)}</li>}
              </ul>
            )}
            {sel.unanswered && <p className="m-muted">The Pick Up Check for this day was not answered.</p>}
            {selected === today && sel.status !== 'holiday' && (
              <Link to="/resident/track" className="ct-btn ct-btn--primary ct-btn--block res-gap">
                See where the truck is <ArrowRight size={15} />
              </Link>
            )}
          </>
        )}
      </section>

      <section className="m-card">
        <ToggleRow
          icon={BellRing}
          label="Remind me on pickup days"
          hint="A reminder will show in this app."
          checked={resident.prefs.scheduleReminders}
          onChange={setReminders}
        />
      </section>

      <section className="m-card m-row">
        <span className="m-icon">
          <Info size={16} />
        </span>
        <div className="m-grow">
          <strong>Big items to throw away?</strong>
          <p className="m-muted">For old furniture or many branches, call the Barangay office at {barangay.hotline}.</p>
        </div>
      </section>
    </div>
  )
}
