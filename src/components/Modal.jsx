import { useEffect } from 'react'
import { X } from 'lucide-react'
import './Modal.css'

// Centered dialog with a dimmed background. Closes on Esc or backdrop click.
export default function Modal({ title, subtitle, icon: Icon, onClose, children, footer, size = 'md', tone }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ct-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ct-modal ct-modal--${size} ${tone ? `ct-modal--${tone}` : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="ct-modal__header">
          {Icon && <Icon size={18} />}
          <div className="ct-modal__titles">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="ct-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="ct-modal__body">{children}</div>
        {footer && <footer className="ct-modal__footer">{footer}</footer>}
      </div>
    </div>
  )
}
