import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, Clock, Info, MapPin, ShieldCheck, Truck } from 'lucide-react'
import StatusBadge from '../../components/StatusBadge.jsx'
import ToggleRow from '../../components/ToggleRow.jsx'
import { useData } from '../../store/dataContext.js'
import { useResident } from '../../auth/useAccount.js'
import { barangay } from '../../data/barangay.js'
import { plainWaste } from '../../data/plainWords.js'
import './ResidentPages.css'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// What goes in which bin (RA 9003 segregation at source).
const guide = [
  { type: 'Food & garden waste', color: '#22a565', bin: 'Own bag', items: 'Food scraps, fruit and vegetable peelings, leaves, garden waste.' },
  { type: 'Recyclables', color: '#2563eb', bin: 'Own bag', items: 'Clean plastic bottles, cartons, paper, cans and metals.' },
  { type: 'Other trash', color: '#5d6e64', bin: 'Own bag', items: 'Diapers, sanitary pads, candy wrappers, styrofoam.' },
  { type: 'Batteries & electronics', color: '#c4231f', bin: 'Drop-off only', items: 'Batteries, bulbs, old phones, chemicals, paint. Bring to the barangay drop-off.' },
]

// PDF page 42
export default function SchedulePage() {
  const { data, dispatch } = useData()
  const resident = useResident()
  const [tab, setTab] = useState('week')
  // Read once when the page opens (not on every redraw).
  const [todayIndex] = useState(() => new Date().getDay())

  // This week, starting today.
  const days = Array.from({ length: 7 }, (_, i) => DAYS[(todayIndex + i) % 7])
  const runs = days.map((day, i) => ({ ...data.weeklySchedule.find((d) => d.day === day), offset: i }))

  function setReminders(value) {
    dispatch({ type: 'resident/update', payload: { id: resident.id, patch: { prefs: { ...resident.prefs, scheduleReminders: value } } } })
  }

  return (
    <div className="m-page">
      <div>
        <div className="m-row m-row--between">
          <h1 className="m-h1">Pickup Days</h1>
          <StatusBadge tone="green">This week</StatusBadge>
        </div>
        <p className="m-muted">
          <MapPin size={11} /> {resident.purok}
        </p>
      </div>

      <div className="ct-alert">
        <ShieldCheck size={15} />
        <span>Please separate your trash before pickup (required by law, RA 9003)</span>
      </div>

      <div className="m-chips" role="group" aria-label="View">
        <button type="button" aria-pressed={tab === 'week'} onClick={() => setTab('week')}>
          This week
        </button>
        <button type="button" aria-pressed={tab === 'guide'} onClick={() => setTab('guide')}>
          How to separate
        </button>
      </div>

      {tab === 'week' ? (
        <>
          <section className="m-card">
            <ToggleRow
              icon={BellRing}
              label="Remind me on pickup days"
              hint="A reminder will show in this app."
              checked={resident.prefs.scheduleReminders}
              onChange={setReminders}
            />
          </section>

          <div className="m-row m-row--between">
            <h2 className="m-section-title">Pickups this week</h2>
            <span className="m-muted">{data.weeklySchedule.filter((d) => d.wasteType !== 'No collection').length} pickup days</span>
          </div>

          {runs.map((run) => {
            const none = run.wasteType === 'No collection'
            const badge = run.offset === 0 ? ['green', 'Today'] : run.offset === 1 ? ['blue', 'Tomorrow'] : ['gray', run.day]
            return (
              <article key={run.day} className={`m-card res-run ${run.offset === 0 ? 'is-today' : ''} ${none ? 'is-none' : ''}`}>
                <div className="m-row m-row--between">
                  <StatusBadge tone={badge[0]}>{badge[1]}</StatusBadge>
                  <span className="m-muted">
                    <Clock size={11} /> {none ? 'No pickup' : run.window}
                  </span>
                </div>
                <h3>{none ? 'No pickup' : plainWaste(run.wasteType)}</h3>
                {!none && (
                  <p className="m-muted">
                    <Truck size={11} /> Truck {data.truck.id} · {run.day}
                  </p>
                )}
                {run.offset === 0 && !none && (
                  <Link to="/resident/track" className="ct-btn ct-btn--primary ct-btn--block res-gap">
                    See where the truck is <ArrowRight size={15} />
                  </Link>
                )}
              </article>
            )
          })}

          <section className="m-card m-row">
            <span className="m-icon">
              <Info size={16} />
            </span>
            <div className="m-grow">
              <strong>Big items to throw away?</strong>
              <p className="m-muted">For old furniture or many branches, call the Barangay office at {barangay.hotline}.</p>
            </div>
          </section>
        </>
      ) : (
        guide.map((g) => (
          <article key={g.type} className="m-card m-row m-row--top">
            <span className="res-guide-swatch" style={{ background: g.color }} aria-hidden="true" />
            <div className="m-grow">
              <div className="m-row m-row--between">
                <strong>{g.type}</strong>
                <span className="ct-tag">{g.bin}</span>
              </div>
              <p className="m-muted">{g.items}</p>
            </div>
          </article>
        ))
      )}
    </div>
  )
}
