import './StatusBadge.css'

// Small coloured pill used in tables and cards (e.g. "Active", "Delayed").
// tone: 'green' | 'amber' | 'red' | 'blue' | 'gray'
export default function StatusBadge({ tone = 'gray', children }) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>
}
