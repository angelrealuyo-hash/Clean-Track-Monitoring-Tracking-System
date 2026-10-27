import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, X } from 'lucide-react'
import Logo from '../../components/Logo.jsx'
import PageLoader from '../../components/PageLoader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import { useAuth } from '../../auth/authContext.js'
import { demoUsers } from '../../data/users.js'
import { useData } from '../../store/dataContext.js'
import { adminNavGroups, findNavItem } from './adminNav.js'
import './AdminLayout.css'


export default function AdminLayout() {
  const { sessions, logout } = useAuth()
  // Older saved sessions may lack these fields; fall back to the demo admin.
  const user = { ...demoUsers.admin, ...sessions.admin }
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { data } = useData()

  const openReports = data.reports.filter((r) => r.status !== 'resolved').length
  const unreadAdmin = data.notifications.filter((n) => n.audience === 'admin' && !n.read).length
  const badges = {
    truck: { text: '1 Truck', className: 'admin-nav__badge--soft' },
    reports: openReports ? { text: openReports, className: 'admin-nav__badge--amber' } : null,
    notifications: unreadAdmin ? { text: unreadAdmin, className: 'admin-nav__badge--red' } : null,
  }

  const current = findNavItem(location.pathname)

  function signOut() {
    // Navigate first so the next sign-in starts at the Dashboard.
    navigate('/admin/login', { replace: true })
    logout('admin')
  }

  return (
    <div className={`admin-shell ${menuOpen ? 'admin-shell--menu-open' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Logo size={38} />
          <div>
            <strong>CleanTrack</strong>
            <span>Barangay Waste Management</span>
          </div>
          <button
            type="button"
            className="ct-icon-btn admin-sidebar__close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          {adminNavGroups.map((group, i) => (
            <ul key={i}>
              {group.map((item) => {
                const badge = item.badge && badges[item.badge]
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `admin-nav__link ${isActive ? 'is-active' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                      {badge && <span className={`admin-nav__badge ${badge.className}`}>{badge.text}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          ))}
          <button type="button" className="admin-nav__link" onClick={signOut}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </nav>

        <div className="admin-profile">
          <span className="admin-avatar">{user.initials}</span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.title}</span>
          </div>
        </div>
      </aside>

      <div className="admin-backdrop" onClick={() => setMenuOpen(false)} />

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="ct-icon-btn admin-topbar__menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <nav className="admin-breadcrumb" aria-label="Breadcrumb">
            <span>CleanTrack</span>
            <span className="admin-breadcrumb__sep">/</span>
            <span>{data.settings.barangayName || 'Barangay'}</span>
            <span className="admin-breadcrumb__sep">/</span>
            <strong>{current?.label ?? 'Admin'}</strong>
          </nav>
          <div className="admin-topbar__right">
            <StatusBadge tone="green">Simulated Demo Mode</StatusBadge>
            <Link to="/admin/notifications" className="ct-icon-btn admin-topbar__bell" aria-label="Notifications">
              <Bell size={20} />
              {unreadAdmin > 0 && <span className="admin-topbar__dot" />}
            </Link>
            <span className="admin-avatar admin-avatar--small" title={user.name}>
              {user.initials}
            </span>
          </div>
        </header>
        <main className="admin-content">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
