import { useId } from 'react'

// A label + hint with an on/off switch on the right.
export default function ToggleRow({ icon: Icon, label, hint, checked, onChange }) {
  const id = useId()
  return (
    <div className="m-toggle">
      {Icon && (
        <span className="m-icon">
          <Icon size={16} />
        </span>
      )}
      <div className="m-grow">
        <strong id={id}>{label}</strong>
        {hint && <p>{hint}</p>}
      </div>
      <label className="ct-switch">
        <input type="checkbox" role="switch" aria-labelledby={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </label>
    </div>
  )
}
