import { Link } from 'react-router-dom'
import { Bell, ClipboardCheck, LayoutDashboard, Route, User } from 'lucide-react'
import MobileAppLayout from '../../components/MobileAppLayout.jsx'
import Logo from '../../components/Logo.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useAuth } from '../../auth/authContext.js'
import { truck } from '../../data/truck.js'
import { notifications } from '../../data/notifications.js'

// Bottom tabs from PDF pages 45-49.
const tabs = [
  { to: '/driver', label: 'Home', icon: LayoutDashboard, end: true, alsoActiveOn: ['/driver/notifications'] },
  { to: '/driver/route', label: 'My Route', icon: Route },
  { to: '/driver/collection', label: 'Collection', icon: ClipboardCheck },
  { to: '/driver/profile', label: 'Profile', icon: User },
]

const unread = notifications.filter((n) => n.audience === 'driver' && !n.read).length

export default function DriverLayout() {
  const { sessions } = useAuth()
  const onShift = sessions.driver?.status === 'on-shift'

  const header = (
    <>
      <Logo variant="driver" size={30} />
      <div className="mobile-header__title">
        <strong>CleanTrack Driver</strong>
        <span>Brgy. San Antonio · {truck.id}</span>
      </div>
      <div className="mobile-header__right">
        <StatusBadge tone={onShift ? 'green' : 'gray'}>{onShift ? 'On Shift' : 'Off Shift'}</StatusBadge>
        <Link to="/driver/notifications" className="ct-icon-btn mobile-bell" aria-label="Notifications">
          <Bell size={20} />
          {unread > 0 && <span className="mobile-bell__count">{unread}</span>}
        </Link>
      </div>
    </>
  )
  return <MobileAppLayout header={header} tabs={tabs} />
}
