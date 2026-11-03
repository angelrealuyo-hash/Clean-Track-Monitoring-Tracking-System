import { Contact, HardHat } from 'lucide-react'
import { ROLES } from '../../../data/personnel.js'
import './collectors.css'

// Driver (blue) or Crew Member (green). The role name and icon are always
// shown, so the colour is never the only cue.
export default function RoleBadge({ type, size = 'md' }) {
  const Icon = type === 'driver' ? Contact : HardHat
  return (
    <span className={`role-badge role-badge--${type} role-badge--${size}`}>
      <Icon size={size === 'sm' ? 12 : 14} aria-hidden="true" />
      {ROLES[type].label}
    </span>
  )
}
