import { Recycle, Trash2, Truck } from 'lucide-react'
import './Logo.css'

const icons = { admin: Trash2, resident: Recycle, driver: Truck }

// Dark green rounded tile with the app's icon, as in the PDF.
export default function Logo({ variant = 'admin', size = 36 }) {
  const Icon = icons[variant]
  return (
    <span className="ct-logo" style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.2} />
    </span>
  )
}
