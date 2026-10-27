import './charts.css'

// Horizontal bars for one measure (e.g. reports per category).
// One hue, value labelled at the end of each bar, tooltip on hover/focus.
// `max` fixes the scale (e.g. 100 for percentages); otherwise the largest value.
export default function BarList({ items, unit = '', label, max: fixedMax }) {
  const max = fixedMax ?? Math.max(1, ...items.map((i) => i.value))
  if (items.length === 0) return <p className="ct-empty">No data yet.</p>
  return (
    <ul className="bar-list" aria-label={label}>
      {items.map((item) => {
        const pct = (item.value / max) * 100
        const tip = `${item.label}: ${item.value}${unit ? ` ${unit}` : ''}${item.detail ? ` · ${item.detail}` : ''}`
        return (
          <li key={item.label} className="bar-list__row" tabIndex={0} aria-label={tip}>
            <span className="bar-list__label">{item.label}</span>
            <span className="bar-list__track">
              <span className="bar-list__bar" style={{ width: `${pct}%` }} />
              <span className="chart-tip" role="tooltip">
                {tip}
              </span>
            </span>
            <span className="bar-list__value">
              {item.value}
              {unit === '%' ? '%' : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
