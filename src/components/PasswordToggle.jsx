import { Eye, EyeOff } from 'lucide-react'

// Show/hide button for password fields, used everywhere for the same behavior:
// password hidden -> closed eye, password visible -> open eye.
export default function PasswordToggle({ visible, onToggle, label = 'password' }) {
  return (
    <button
      type="button"
      className="ct-icon-btn ct-pw-toggle"
      onClick={onToggle}
      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={visible}
      title={visible ? `Hide ${label}` : `Show ${label}`}
    >
      {visible ? <Eye size={16} /> : <EyeOff size={16} />}
    </button>
  )
}
