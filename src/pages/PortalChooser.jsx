import { Link } from 'react-router-dom'
import { ArrowRight, House, MonitorCog, Truck } from 'lucide-react'
import Logo from '../components/Logo.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import './PortalChooser.css'

const portals = [
  {
    to: '/admin',
    icon: MonitorCog,
    title: 'Admin Website',
    who: 'Barangay office staff',
    text: 'Monitor the truck, manage routes and schedules, and handle resident reports.',
  },
  {
    to: '/resident',
    icon: House,
    title: 'Resident App',
    who: 'Households',
    text: 'See the collection schedule, track the truck, and report missed pickups.',
  },
  {
    to: '/driver',
    icon: Truck,
    title: 'Driver App',
    who: 'Garbage truck driver',
    text: 'Follow the route stop by stop and mark stops as collected.',
  },
]

// Start page: pick which of the three apps to open.
export default function PortalChooser() {
  return (
    <div className="portal">
      <header className="portal__header">
        <Logo size={56} />
        <h1>CleanTrack</h1>
        <p>Garbage Truck Monitoring System</p>
        <StatusBadge tone="amber">Student project prototype · Truck locations are simulated</StatusBadge>
      </header>

      <div className="portal__grid">
        {portals.map(({ to, icon: Icon, title, who, text }) => (
          <Link key={to} to={to} className="portal__card">
            <span className="portal__icon">
              <Icon size={24} />
            </span>
            <h2>{title}</h2>
            <span className="portal__who">{who}</span>
            <p>{text}</p>
            <span className="portal__go">
              Open <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
