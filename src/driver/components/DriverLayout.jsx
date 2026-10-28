import { Link } from 'react-router-dom'
import { Bell, LayoutDashboard, Route, User } from 'lucide-react'
import MobileAppLayout from '../../components/MobileAppLayout.jsx'
import Logo from '../../components/Logo.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useData } from '../../store/dataContext.js'
import { useDriver } from '../../auth/useAccount.js'
import { driverStatusMeta } from '../../store/selectors.js'

// Three bottom tabs. Collecting at each stop happens inside My Route.
const tabs = [
  { to: '/driver', label: 'Home', icon: LayoutDashboard, end: true, alsoActiveOn: ['/driver/notifications', '/driver/report'] },
  { to: '/driver/route', label: 'My Route', icon: Route },
  { to: '/driver/profile', label: 'Profile', icon: User },
]

export default function DriverLayout() {
  const { data } = useData()
  const driver = useDriver()
  const unread = data.notifications.filter((n) => n.audience === 'driver' && !n.read).length
  const status = driverStatusMeta[driver?.status ?? 'off-duty']

  const header = (
    <>
      <Logo variant="driver" size={30} />
      <div className="mobile-header__title">
        <strong>CleanTrack Driver</strong>
        <span>
          {data.settings.barangayName ? `${data.settings.barangayName} · ` : ''}Truck {data.truck.id}
        </span>
      </div>
      <div className="mobile-header__right">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        <Link to="/driver/notifications" className="ct-icon-btn mobile-bell" aria-label={`Notifications, ${unread} unread`}>
          <Bell size={20} />
          {unread > 0 && <span className="mobile-bell__count">{unread}</span>}
        </Link>
      </div>
    </>
  )
  return <MobileAppLayout header={header} tabs={tabs} />
}
