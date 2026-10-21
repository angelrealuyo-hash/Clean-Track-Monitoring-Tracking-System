// Key for the map symbols.
export default function MapLegend({ className = '' }) {
  return (
    <div className={`ct-map-legend ${className}`}>
      <span><i className="is-truck" /> Truck (simulated)</span>
      <span><i className="is-collected" /> Collected</span>
      <span><i className="is-next" /> Next stop</span>
      <span><i className="is-pending" /> Pending</span>
      <span><i className="is-depot" /> Depot</span>
    </div>
  )
}
