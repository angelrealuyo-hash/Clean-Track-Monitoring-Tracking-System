import './charts.css'

// One stacked bar showing how today's stops split across statuses.
// Status colours always come with a text legend + counts (never colour alone).
export default function StatusBar({ segments, total, label }) {
  const shown = segments.filter((s) => s.value > 0)
  return (
    <div className="status-bar" aria-label={label}>
      <div className="status-bar__track">
        {total === 0 ? (
          <span className="status-bar__empty">No stops</span>
        ) : (
          shown.map((s) => {
            const tip = `${s.label}: ${s.value} of ${total} (${Math.round((s.value / total) * 100)}%)`
            return (
              <span
                key={s.key}
                className={`status-bar__seg is-${s.key}`}
                style={{ flexGrow: s.value }}
                tabIndex={0}
                aria-label={tip}
              >
                <span className="chart-tip" role="tooltip">
                  {tip}
                </span>
              </span>
            )
          })
        )}
      </div>
      <ul className="status-bar__legend">
        {segments.map((s) => (
          <li key={s.key}>
            <i className={`is-${s.key}`} />
            {s.label} <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
