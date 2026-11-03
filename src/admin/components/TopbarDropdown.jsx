import { useEffect, useId, useRef } from 'react'

// A button in the admin top bar that opens a small panel below it.
// The panel closes on outside click, on Esc, or when `onClose` is called
// (e.g. after choosing an item). Only one panel is open at a time:
// AdminLayout keeps which one is open.
export default function TopbarDropdown({ open, onToggle, onClose, button, buttonLabel, buttonClassName = '', panelClassName = '', children }) {
  const ref = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose()
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      onClose()
      ref.current?.querySelector('button')?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div className="topbar-dd" ref={ref}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={buttonLabel}
        title={buttonLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
      >
        {button}
      </button>
      {open && (
        <div id={panelId} className={`topbar-dd__panel ${panelClassName}`}>
          {children}
        </div>
      )}
    </div>
  )
}
