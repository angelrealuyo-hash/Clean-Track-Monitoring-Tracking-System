import './MobileFrame.css'

// Phone-sized column for the Resident and Driver apps.
// Fills the screen on phones; shows as a centered phone on desktops.
export default function MobileFrame({ children }) {
  return (
    <div className="mobile-stage">
      <div className="mobile-frame">{children}</div>
    </div>
  )
}
