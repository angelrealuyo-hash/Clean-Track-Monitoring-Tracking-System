import { Link } from 'react-router-dom'
import { Bell, CalendarDays, ClipboardList, House, User } from 'lucide-react'
import MobileAppLayout from '../../components/MobileAppLayout.jsx'
import Logo from '../../components/Logo.jsx'
import { notifications } from '../../data/notifications.js'

// Bottom tabs from PDF pages 36-43.
const tabs = [
  { to: '/resident', label: 'Home', icon: House, end: true, alsoActiveOn: ['/resident/track', '/resident/notifications'] },
  { to: '/resident/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/resident/reports', label: 'My Reports', icon: ClipboardList },
  { to: '/resident/profile', label: 'Profile', icon: User },
]

const unread = notifications.filter((n) => n.audience === 'resident' && !n.read).length

export default function ResidentLayout() {
  const header = (
    <>
      <Logo variant="resident" size={30} />
      <div className="mobile-header__title">
        <strong>CleanTrack Resident</strong>
        <span>Barangay San Antonio</span>
      </div>
      <div className="mobile-header__right">
        <Link to="/resident/notifications" className="ct-icon-btn mobile-bell" aria-label="Notifications">
          <Bell size={20} />
          {unread > 0 && <span className="mobile-bell__count">{unread}</span>}
        </Link>
      </div>
    </>
  )
  return <MobileAppLayout header={header} tabs={tabs} />
}
