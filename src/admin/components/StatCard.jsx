import './StatCard.css'

// Summary card from the PDF dashboard: label, icon tile, big value, detail line.
export default function StatCard({ label, icon: Icon, value, unit, children, highlight = false, tone = 'green' }) {
  return (
    <article className={`stat-card ${highlight ? 'stat-card--highlight' : ''}`}>
      <header>
        <span className="stat-card__label">{label}</span>
        <span className={`stat-card__icon stat-card__icon--${tone}`}>
          <Icon size={18} />
        </span>
      </header>
      <p className="stat-card__value">
        {value}
        {unit && <span>{unit}</span>}
      </p>
      <div className="stat-card__detail">{children}</div>
    </article>
  )
}
