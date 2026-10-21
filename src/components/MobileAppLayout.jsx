import { Link, Outlet, useLocation } from 'react-router-dom'
import MobileFrame from './MobileFrame.jsx'
import './MobileAppLayout.css'

// Shared shell for the Resident and Driver apps: header + scrolling content
// + bottom tab bar.
// tabs: [{ to, label, icon, end?, alsoActiveOn?: [paths] }]
export default function MobileAppLayout({ header, tabs }) {
  const { pathname } = useLocation()

  function isActive(tab) {
    if (tab.alsoActiveOn?.some((p) => pathname.startsWith(p))) return true
    return tab.end ? pathname === tab.to : pathname.startsWith(tab.to)
  }

  return (
    <MobileFrame>
      <header className="mobile-header">{header}</header>
      <main className="mobile-content">
        <Outlet />
      </main>
      <nav className="mobile-tabs" aria-label="Main">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`mobile-tabs__item ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </MobileFrame>
  )
}
