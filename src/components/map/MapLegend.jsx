// Key for the map symbols. `plain` uses everyday words (Resident/Driver apps).
export default function MapLegend({ className = '', plain = false }) {
  if (plain) {
    return (
      <div className={`ct-map-legend ${className}`}>
        <span><i className="is-truck" /> Truck</span>
        <span><i className="is-collected" /> Picked up</span>
        <span><i className="is-next" /> Going here next</span>
        <span><i className="is-missed" /> Could not pick up</span>
        <span><i className="is-pending" /> Not yet</span>
        <span><i className="is-depot" /> Truck parking</span>
      </div>
    )
  }
  return (
    <div className={`ct-map-legend ${className}`}>
      <span><i className="is-truck" /> Truck (simulated)</span>
      <span><i className="is-collected" /> Collected</span>
      <span><i className="is-next" /> Next stop</span>
      <span><i className="is-missed" /> Missed</span>
      <span><i className="is-pending" /> Pending</span>
      <span><i className="is-depot" /> Depot</span>
    </div>
  )
}
