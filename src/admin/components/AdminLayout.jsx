import { Suspense, useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, ChevronRight, LogOut, Menu, Settings, X } from 'lucide-react'
import Logo from '../../components/Logo.jsx'
import PageLoader from '../../components/PageLoader.jsx'
import StatusBadge from '../../components/StatusBadge.jsx'
import Avatar from '../../components/Avatar.jsx'
import { useAuth } from '../../auth/authContext.js'
import { demoUsers } from '../../data/users.js'
import { useData } from '../../store/dataContext.js'
import SignOutConfirm from '../../components/SignOutConfirm.jsx'
import { priorityMeta } from '../../store/selectors.js'
import { formatDateTime } from '../../utils/format.js'
import TopbarDropdown from './TopbarDropdown.jsx'
import { adminNavGroups, findNavItem } from './adminNav.js'
import './AdminLayout.css'


export default function AdminLayout() {
  const { sessions, logout } = useAuth()
  // Older saved sessions may lack these fields; fall back to the demo admin.
  const user = { ...demoUsers.admin, ...sessions.admin }
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdown, setDropdown] = useState(null) // 'notifications' | 'profile' | null
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const closeDropdown = useCallback(() => setDropdown(null), [])
  const toggle = (name) => setDropdown((d) => (d === name ? null : name))
  const { data, dispatch } = useData()

  const openReports = data.reports.filter((r) => r.status !== 'resolved').length
  const adminFeed = data.notifications.filter((n) => n.audience === 'admin')
  const unreadAdmin = adminFeed.filter((n) => !n.read).length
  // Newest first; the dropdown shows a short preview.
  const preview = [...adminFeed].sort((a, b) => String(b.time).localeCompare(String(a.time))).slice(0, 5)
  const badges = {
    truck: { text: '1 Truck', className: 'admin-nav__badge--soft' },
    reports: openReports ? { text: openReports, className: 'admin-nav__badge--amber' } : null,
    notifications: unreadAdmin ? { text: unreadAdmin, className: 'admin-nav__badge--red' } : null,
  }

  const current = findNavItem(location.pathname)

  // Each admin page opens at the top (with its title and buttons visible),
  // not at the scroll position of the previous page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  function signOut() {
    // Navigate first so the next sign-in starts at the Dashboard.
    navigate('/admin/login', { replace: true })
    logout('admin')
  }

  function askSignOut() {
    setDropdown(null)
    setMenuOpen(false)
    setConfirmSignOut(true)
  }

  function openNotification(n) {
    setDropdown(null)
    if (!n.read) dispatch({ type: 'notification/markRead', payload: { id: n.id } })
    navigate(`/admin/notifications?id=${encodeURIComponent(n.id)}`)
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
        </nav>

        {/* Sign Out sits at the bottom of the sidebar. */}
        <div className="admin-sidebar__footer">
          <button type="button" className="admin-nav__link admin-nav__signout" onClick={askSignOut}>
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
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
            <TopbarDropdown
              open={dropdown === 'notifications'}
              onToggle={() => toggle('notifications')}
              onClose={closeDropdown}
              buttonLabel={unreadAdmin ? `Notifications, ${unreadAdmin} unread` : 'Notifications'}
              buttonClassName="ct-icon-btn admin-topbar__bell"
              panelClassName="topbar-dd__panel--notif"
              button={
                <>
                  <Bell size={20} />
                  {unreadAdmin > 0 && <span className="admin-topbar__dot" />}
                </>
              }
            >
              <div className="topbar-dd__head">
                <strong>Notifications</strong>
                {unreadAdmin > 0 ? (
                  <button
                    type="button"
                    className="ct-link-btn"
                    onClick={() => dispatch({ type: 'notification/markAllRead', payload: { audience: 'admin' } })}
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                ) : (
                  <span className="topbar-dd__muted">All caught up</span>
                )}
              </div>
              {preview.length === 0 ? (
                <p className="topbar-dd__empty">No notifications yet.</p>
              ) : (
                <ul className="topbar-dd__list">
                  {preview.map((n) => (
                    <li key={n.id}>
                      <button type="button" className={`topbar-dd__notif ${n.read ? '' : 'is-unread'}`} onClick={() => openNotification(n)}>
                        <span className={`topbar-dd__prio is-${priorityMeta[n.priority]?.tone ?? 'green'}`} aria-hidden="true" />
                        <span className="topbar-dd__notif-text">
                          <strong>{n.title}</strong>
                          {n.body && <span>{n.body}</span>}
                          <small>
                            {formatDateTime(n.time)}
                            {!n.read && ' · Unread'}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/admin/notifications" className="topbar-dd__foot" onClick={closeDropdown}>
                View all notifications <ChevronRight size={14} />
              </Link>
            </TopbarDropdown>

            <TopbarDropdown
              open={dropdown === 'profile'}
              onToggle={() => toggle('profile')}
              onClose={closeDropdown}
              buttonLabel={`${user.name}, account menu`}
              buttonClassName="admin-avatar--link"
              panelClassName="topbar-dd__panel--profile"
              button={<Avatar photo={data.adminPhoto} initials={user.initials} className="admin-avatar admin-avatar--small" />}
            >
              <div className="topbar-dd__user">
                <Avatar photo={data.adminPhoto} initials={user.initials} className="admin-avatar" />
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.title}</span>
                  {user.email && <small>{user.email}</small>}
                </div>
              </div>
              <ul className="topbar-dd__menu">
                <li>
                  <Link to="/admin/settings" onClick={closeDropdown}>
                    <Settings size={16} /> Account &amp; Settings
                  </Link>
                </li>
                <li>
                  <button type="button" className="is-danger" onClick={askSignOut}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </li>
              </ul>
            </TopbarDropdown>
          </div>
        </header>
        <main className="admin-content">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {confirmSignOut && <SignOutConfirm onClose={() => setConfirmSignOut(false)} onConfirm={signOut} />}
    </div>
  )
}
