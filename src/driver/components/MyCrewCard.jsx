import { Users } from 'lucide-react'
import Avatar from '../../components/Avatar.jsx'
import { initials } from '../../store/dataReducer.js'

// The crew working on this driver's truck (set by the office in Collector's
// Management). View only.
export default function MyCrewCard({ crew, assigned, compact = false }) {
  return (
    <section className="m-card" aria-labelledby="drv-crew-title">
      <div className="m-row m-row--between">
        <strong id="drv-crew-title">
          <Users size={14} /> My Crew
        </strong>
        {crew.length > 0 && <span className="m-muted">{crew.length} on the truck</span>}
      </div>
      {!assigned ? (
        <p className="m-muted drv-gap">You will see your crew when you are assigned to the truck.</p>
      ) : crew.length === 0 ? (
        <p className="m-muted drv-gap">No crew members assigned yet.</p>
      ) : (
        <ul className={`drv-crew ${compact ? 'is-compact' : ''}`}>
          {crew.map((c) => (
            <li key={c.id}>
              <Avatar photo={c.photo} initials={initials(c.name)} name={c.name} className="ct-avatar drv-crew__avatar" />
              <span>
                <strong>{c.name}</strong>
                <small>{c.role}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
