import { X } from 'lucide-react'
import './DetailPanel.css'

// Right-hand details card used across Admin screens (PDF p.12, 18, 21, 26, 27).
export default function DetailPanel({ icon: Icon, title, subtitle, badge, onClose, children, footer, label }) {
  return (
    <aside className="ct-card detail-panel" aria-label={label ?? title}>
      <header className="detail-panel__head">
        {Icon && (
          <span className="ct-logo" style={{ width: 36, height: 36 }}>
            <Icon size={18} />
          </span>
        )}
        <div className="detail-panel__titles">
          <h2>{title}</h2>
          {(subtitle || badge) && (
            <p>
              {subtitle} {badge}
            </p>
          )}
        </div>
        {onClose && (
          <button type="button" className="ct-icon-btn" onClick={onClose} aria-label="Close details">
            <X size={18} />
          </button>
        )}
      </header>
      <div className="detail-panel__body">{children}</div>
      {footer && <footer className="detail-panel__foot">{footer}</footer>}
    </aside>
  )
}

export function DetailSection({ icon: Icon, title, action, children }) {
  return (
    <section className="detail-panel__section">
      <h3>
        {Icon && <Icon size={14} />}
        <span>{title}</span>
        {action}
      </h3>
      <div className="detail-panel__box">{children}</div>
    </section>
  )
}
