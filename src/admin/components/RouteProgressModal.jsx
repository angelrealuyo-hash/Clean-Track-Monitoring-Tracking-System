import { Route } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useTracking } from '../../tracking/trackingContext.js'
import { SIMULATION_LABEL } from '../../services/trackingSimulation.js'
import './RouteProgressModal.css'

const stopText = {
  collected: 'Collected',
  next: 'Truck heading here now',
  pending: 'Pending',
  depot: 'Depot',
}

// "View Route" dialog (PDF page 10): totals plus every stop in order.
export default function RouteProgressModal({ truckId, onClose }) {
  const { route, progress } = useTracking()

  return (
    <Modal
      title={`${truckId} Route Progress`}
      icon={Route}
      onClose={onClose}
      footer={
        <button type="button" className="ct-btn ct-btn--primary" onClick={onClose}>
          Close View
        </button>
      }
    >
      <p className="route-modal__sub">
        {route.name} · starts {route.startTime}
      </p>

      <div className="route-modal__stats">
        <div>
          <span>Total stops</span>
          <strong>{progress.total}</strong>
        </div>
        <div>
          <span>Collected</span>
          <strong className="is-green">{progress.collected}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong className="is-amber">{progress.remaining}</strong>
        </div>
      </div>

      {route.stops.length === 0 ? (
        <p className="ct-empty">This route has no stops yet.</p>
      ) : (
        <ol className="ct-timeline route-modal__list">
          {route.stops.map((stop) => {
            const status = progress.statusOf(stop)
            return (
              <li key={stop.id} className={`is-${status}`}>
                <span className="ct-timeline__dot" />
                <div>
                  <strong>{stop.name}</strong>
                  <small>
                    {stop.purok}
                    {stop.households > 0 && ` · ${stop.households} households`} · {stopText[status]}
                  </small>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="route-modal__note">
        <StatusBadge tone="amber">{SIMULATION_LABEL}</StatusBadge>
      </div>
    </Modal>
  )
}
